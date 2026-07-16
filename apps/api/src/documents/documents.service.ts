import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Prisma, documents } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface UserLike {
  id: number;
  role: string;
}

@Injectable()
export class DocumentsService {
  private readonly allowedSortFields = [
    'id',
    'created_at',
    'updated_at',
    'title',
    'document_type',
    'file_size',
    'status',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(
    file: Express.Multer.File,
    user: UserLike,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!file) throw new BadRequestException('No file uploaded');

    const { bucket, folder } = this.resolveBucket(dto);
    const result = await this.storage.upload(
      file.buffer,
      bucket,
      file.originalname,
      file.mimetype,
      folder,
    );
    if (!result.success) {
      throw new InternalServerErrorException(result.error || 'Upload failed');
    }

    const payload = this.buildDocumentPayload(dto, result.key, result.url, bucket, file);
    payload.uploaded_by = user.id;

    const doc = await this.prisma.documents.create({
      data: payload as Prisma.documentsCreateInput,
      include: { profiles_documents_uploaded_byToprofiles: true },
    });

    return { message: 'Document uploaded successfully', document: this.mapDocument(doc) };
  }

  async findAll(
    user: UserLike,
    query: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = this.allowedSortFields.includes(this.asString(query.sort_by) || '')
      ? (this.asString(query.sort_by) as string)
      : 'created_at';
    const sortOrder = this.asString(query.sort_order) === 'asc' ? 'asc' : 'desc';

    const where = this.buildWhere(query);

    const rows = await this.prisma.documents.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: { profiles_documents_uploaded_byToprofiles: true },
    });

    const accessible = this.isAdminOrManager(user)
      ? rows
      : rows.filter((doc) => this.canAccess(doc, user));

    const enriched = await Promise.all(
      accessible.map(async (doc) => this.enrichAndMapDocument(doc)),
    );

    let projectDocuments: Record<string, unknown>[] = [];
    if (this.isAdminOrManager(user)) {
      projectDocuments = await this.findProjectDocuments(limit);
    }

    const allDocuments = [...enriched, ...projectDocuments].sort(
      (a, b) =>
        new Date((b.created_at as string) || 0).getTime() -
        new Date((a.created_at as string) || 0).getTime(),
    );

    const totalItems = allDocuments.length;
    const paginated = allDocuments.slice(skip, skip + limit);

    return {
      documents: paginated,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
      },
    };
  }

  async findOne(id: number, user: UserLike): Promise<Record<string, unknown>> {
    const doc = await this.prisma.documents.findUnique({
      where: { id },
      include: { profiles_documents_uploaded_byToprofiles: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canAccess(doc, user)) throw new ForbiddenException('Access denied to this document');
    return { document: await this.enrichAndMapDocument(doc) };
  }

  async findByEntity(
    user: UserLike,
    type: string,
    id: number,
  ): Promise<Record<string, unknown>> {
    const rows = await this.prisma.documents.findMany({
      where: {
        related_entity_type: type,
        related_entity_id: id,
        status: 'active',
      },
      orderBy: { created_at: 'desc' },
      include: { profiles_documents_uploaded_byToprofiles: true },
    });

    const accessible = rows.filter((doc) => this.canAccess(doc, user));
    return {
      documents: await Promise.all(accessible.map((doc) => this.enrichAndMapDocument(doc))),
    };
  }

  async signedUrl(id: string, user: UserLike): Promise<{ url: string }> {
    let fileUrl: string | null = null;
    let storageKey: string | null = null;
    let bucket: string | null = null;

    if (id.startsWith('project-')) {
      if (!this.isAdminOrManager(user)) {
        throw new ForbiddenException('Access denied to this document');
      }
      const projectDocId = Number(id.slice('project-'.length));
      const doc = await this.prisma.crm_project_documents.findUnique({
        where: { id: projectDocId },
      });
      if (!doc) throw new NotFoundException('Document not found');
      fileUrl = doc.file_url;
      storageKey = doc.storage_key ?? null;
      bucket = this.inferBucket(doc.file_url);
    } else {
      const numericId = Number(id);
      if (!Number.isInteger(numericId)) throw new NotFoundException('Document not found');
      const doc = await this.prisma.documents.findUnique({
        where: { id: numericId },
      });
      if (!doc) throw new NotFoundException('Document not found');
      if (!this.canAccess(doc, user)) {
        throw new ForbiddenException('Access denied to this document');
      }
      fileUrl = doc.file_url ?? null;
      storageKey = doc.storage_key ?? null;
      bucket = doc.bucket ?? this.inferBucket(doc.file_url ?? '');
    }

    if (!storageKey) {
      throw new BadRequestException('Document storage key is unavailable');
    }

    const parsed = fileUrl ? this.storage.parseStorageUrl(fileUrl) : null;
    const resolvedBucket = bucket || parsed?.bucket || 'documents';
    const resolvedKey = storageKey || parsed?.key;
    if (!resolvedKey) throw new BadRequestException('Document storage key is unavailable');

    const urlResult = await this.storage.getSignedUrl(resolvedBucket, resolvedKey, 3600);
    if (!urlResult.success || !urlResult.url) {
      throw new InternalServerErrorException(urlResult.error || 'Failed to generate document URL');
    }
    return { url: urlResult.url };
  }

  async update(
    id: number,
    user: UserLike,
    dto: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const doc = await this.prisma.documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canModify(doc, user)) throw new ForbiddenException('Not authorized to update this document');

    const payload = this.buildDocumentPayload(dto, doc.storage_key, doc.file_url ?? null, doc.bucket, null, true);
    delete (payload).uploaded_by;

    const updated = await this.prisma.documents.update({
      where: { id },
      data: payload,
      include: { profiles_documents_uploaded_byToprofiles: true },
    });

    return { message: 'Document updated successfully', document: await this.enrichAndMapDocument(updated) };
  }

  async share(
    id: number,
    user: UserLike,
    dto: { shared_with_users?: number[]; shared_with_roles?: string[] },
  ): Promise<Record<string, unknown>> {
    const doc = await this.prisma.documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canModify(doc, user)) throw new ForbiddenException('Not authorized to share this document');

    const existingUsers = this.asArray<number>(doc.shared_with_users);
    const existingRoles = this.asArray<string>(doc.shared_with_roles);

    const users = dto.shared_with_users
      ? Array.from(new Set([...existingUsers, ...dto.shared_with_users]))
      : existingUsers;
    const roles = dto.shared_with_roles
      ? Array.from(new Set([...existingRoles, ...dto.shared_with_roles]))
      : existingRoles;

    const updated = await this.prisma.documents.update({
      where: { id },
      data: {
        shared_with_users: users,
        shared_with_roles: roles,
      },
      include: { profiles_documents_uploaded_byToprofiles: true },
    });

    return { message: 'Document shared successfully', document: await this.enrichAndMapDocument(updated) };
  }

  async remove(id: number, user: UserLike): Promise<Record<string, unknown>> {
    const doc = await this.prisma.documents.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.canModify(doc, user)) throw new ForbiddenException('Not authorized to delete this document');

    await this.storage.deleteByUrl(doc.file_url ?? '', [doc.bucket, 'documents', 'financial']);
    await this.prisma.documents.update({
      where: { id },
      data: { status: 'deleted' },
    });

    return { message: 'Document deleted successfully' };
  }

  async stats(user: UserLike): Promise<Record<string, unknown>> {
    if (!this.isAdminOrManager(user)) {
      throw new ForbiddenException('Admin access required');
    }

    const allDocs = await this.prisma.documents.findMany({
      select: { document_type: true, file_size: true, status: true },
    });

    const countsByType: Record<string, number> = {};
    const countsByStatus: Record<string, number> = {};
    let totalSize = 0;
    for (const doc of allDocs) {
      countsByType[doc.document_type] = (countsByType[doc.document_type] || 0) + 1;
      countsByStatus[doc.status || 'active'] = (countsByStatus[doc.status || 'active'] || 0) + 1;
      totalSize += doc.file_size || 0;
    }

    const projectDocs = await this.prisma.crm_project_documents.count();

    return {
      stats: {
        totalDocuments: allDocs.length,
        totalSize,
        averageSize: allDocs.length ? Math.round(totalSize / allDocs.length) : 0,
        byType: countsByType,
        byStatus: countsByStatus,
        projectDocuments: projectDocs,
      },
    };
  }

  private buildWhere(query: Record<string, unknown>): Prisma.documentsWhereInput {
    const where: Prisma.documentsWhereInput = { status: 'active' };

    const type = this.asString(query.type);
    if (type) {
      where.document_type = type as any;
    }
    const category = this.asString(query.category);
    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }
    const search = this.asString(query.search);
    if (search) {
      const pattern = `%${search}%`;
      where.AND = {
        OR: [
          { title: { contains: pattern, mode: 'insensitive' } },
          { description: { contains: pattern, mode: 'insensitive' } },
          { original_filename: { contains: pattern, mode: 'insensitive' } },
        ],
      };
    }

    return where;
  }

  private async findProjectDocuments(limit: number): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.crm_project_documents.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { profiles: { select: { id: true, first_name: true, last_name: true, email: true } } },
    });
    return rows.map((doc) => ({
      id: `project-${doc.id}`,
      source_id: doc.id,
      project_id: doc.project_id,
      title: doc.file_name,
      filename: doc.file_name,
      type: 'project',
      category: 'project',
      size: doc.file_size,
      url: doc.file_url,
      file_url: doc.file_url,
      mime_type: doc.file_type,
      uploaded_by: doc.profiles ? `${doc.profiles.first_name} ${doc.profiles.last_name}` : 'Unknown',
      created_at: doc.created_at,
      download_count: 0,
    }));
  }

  private buildDocumentPayload(
    dto: Record<string, unknown>,
    storageKey: string,
    fileUrl: string | null,
    bucket: string,
    file: Express.Multer.File | null,
    isUpdate = false,
  ): Record<string, unknown> {
    const title = this.asString(dto.title) ?? (file ? file.originalname : undefined);
    const documentType = this.asString(dto.document_type) || 'other';

    const payload: Record<string, unknown> = {
      filename: file ? String(file.originalname) : undefined,
      original_filename: file ? file.originalname : undefined,
      file_path: storageKey,
      file_url: fileUrl,
      mime_type: file ? file.mimetype : undefined,
      file_size: file ? file.size : undefined,
      bucket,
      storage_key: storageKey,
      document_type: documentType,
      category: this.asString(dto.category),
      title,
      description: this.asString(dto.description),
      is_sensitive: this.parseBoolean(dto.is_sensitive),
      is_public: this.parseBoolean(dto.is_public),
      access_level: this.asString(dto.access_level),
      related_entity_type: this.asString(dto.related_entity_type),
      related_entity_id: this.asNumber(dto.related_entity_id),
      tags: this.parseJsonArray(dto.tags),
      shared_with_users: this.parseJsonArray<number>(dto.shared_with_users),
      shared_with_roles: this.parseJsonArray<string>(dto.shared_with_roles),
      expires_at: this.asString(dto.expires_at)
        ? new Date(this.asString(dto.expires_at) as string)
        : undefined,
    };

    if (!isUpdate) {
      payload.status = 'active';
      payload.version = '1.0';
    } else if (dto.status) {
      payload.status = this.asString(dto.status);
    }

    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    return payload;
  }

  private async enrichAndMapDocument(doc: documents & { profiles_documents_uploaded_byToprofiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null }): Promise<Record<string, unknown>> {
    let url = doc.file_url ?? null;
    if (doc.storage_key && doc.bucket) {
      const refreshed = await this.storage.getSignedUrl(doc.bucket, doc.storage_key, 3600);
      if (refreshed.success && refreshed.url) {
        url = refreshed.url;
      }
    }

    return this.mapDocument(doc, url);
  }

  private mapDocument(
    doc: documents & { profiles_documents_uploaded_byToprofiles?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null },
    url?: string | null,
  ): Record<string, unknown> {
    const uploader = doc.profiles_documents_uploaded_byToprofiles;
    return {
      id: doc.id,
      filename: doc.filename,
      original_filename: doc.original_filename,
      title: doc.title,
      description: doc.description,
      type: doc.document_type,
      category: doc.category,
      size: doc.file_size,
      url,
      file_url: doc.file_url,
      mime_type: doc.mime_type,
      is_sensitive: doc.is_sensitive,
      is_public: doc.is_public,
      access_level: doc.access_level,
      tags: doc.tags,
      uploaded_by: uploader ? `${uploader.first_name} ${uploader.last_name}` : 'Unknown',
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      download_count: doc.download_count,
      status: doc.status,
    };
  }

  private resolveBucket(dto: Record<string, unknown>): { bucket: string; folder: string } {
    const type = this.asString(dto.document_type) || 'other';
    const sensitive = this.parseBoolean(dto.is_sensitive);
    const financialTypes = ['invoice', 'estimate', 'receipt', 'expense'];

    let bucket = 'documents';
    let folder = '';

    if (financialTypes.includes(type)) {
      bucket = 'financial';
      folder = `${type}s`;
    } else if (type === 'company') {
      folder = 'company';
    } else if (type === 'employee') {
      folder = 'employees';
    } else if (type === 'client') {
      folder = 'clients';
    } else if (type === 'guideline') {
      folder = 'guidelines';
    } else if (sensitive) {
      folder = 'sensitive';
    }

    return { bucket, folder };
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  }

  private parseJsonArray<T>(value: unknown): T[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private asString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return undefined;
  }

  private asNumber(value: unknown): number | undefined {
    const str = this.asString(value);
    if (!str) return undefined;
    const num = Number(str);
    return Number.isNaN(num) ? undefined : num;
  }

  private asArray<T>(value: unknown): T[] {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value as T[];
    return [];
  }

  private canAccess(doc: documents, user: UserLike): boolean {
    if (this.isAdminOrManager(user)) return true;
    if (doc.is_public) return true;
    if (doc.uploaded_by === user.id) return true;
    const users = this.asArray<number>(doc.shared_with_users);
    const roles = this.asArray<string>(doc.shared_with_roles);
    return users.includes(user.id) || roles.includes(user.role);
  }

  private canModify(doc: documents, user: UserLike): boolean {
    if (this.isAdminOrManager(user)) return true;
    return doc.uploaded_by === user.id;
  }

  private isAdminOrManager(user: UserLike): boolean {
    return ['admin', 'manager'].includes(user.role.toLowerCase());
  }

  private inferBucket(url: string): string | null {
    const parsed = this.storage.parseStorageUrl(url);
    return parsed?.bucket || null;
  }
}
