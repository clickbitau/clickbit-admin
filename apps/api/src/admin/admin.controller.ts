import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RequestWithUser } from '../types/request-with-user';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('data')
  getData(@Req() req: RequestWithUser) {
    return this.adminService.getData(req.user);
  }

  @Get('dashboard/stats')
  async dashboardStats(@Req() req?: RequestWithUser) {
    return this.adminService.getDashboardStats(req?.user);
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  @Get('comments/pending')
  async pendingComments() {
    return this.adminService.pendingComments();
  }

  @Get('comments')
  async listComments(@Query() query: any) {
    return this.adminService.listComments(query);
  }

  @Put('comments/:id/status')
  async updateCommentStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.adminService.updateCommentStatus(id, status);
  }

  @Delete('comments/:id')
  async deleteComment(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteComment(id);
  }

  // -------------------------------------------------------------------------
  // Posts
  // -------------------------------------------------------------------------
  @Get('posts')
  async listPosts(@Query() query: any) {
    return this.adminService.listPosts(query);
  }

  @Get('posts/:id')
  async getPost(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPost(id);
  }

  @Post('posts')
  async createPost(@Body() body: any, @Req() req: RequestWithUser) {
    return this.adminService.createPost(body, req.user.id);
  }

  @Put('posts/:id')
  async updatePost(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updatePost(id, body);
  }

  @Patch('posts/:id')
  async patchPost(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.patchPost(id, body);
  }

  @Delete('posts/:id')
  async deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deletePost(id);
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------
  @Get('categories')
  async listCategories() {
    return this.adminService.listCategories();
  }

  // -------------------------------------------------------------------------
  // Portfolio
  // -------------------------------------------------------------------------
  @Get('portfolio')
  async listPortfolio(@Query() query: any) {
    return this.adminService.listPortfolio(query);
  }

  @Get('portfolio/:id')
  async getPortfolio(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPortfolio(id);
  }

  @Post('portfolio')
  async createPortfolio(@Body() body: any) {
    return this.adminService.createPortfolio(body);
  }

  @Put('portfolio/:id')
  async updatePortfolio(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updatePortfolio(id, body);
  }

  @Patch('portfolio/:id')
  async patchPortfolio(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.patchPortfolio(id, body);
  }

  @Delete('portfolio/:id')
  async deletePortfolio(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deletePortfolio(id);
  }

  // -------------------------------------------------------------------------
  // Services
  // -------------------------------------------------------------------------
  @Get('services')
  async listServices(@Query() query: any) {
    return this.adminService.listServices(query);
  }

  @Get('services/:slug/detail')
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.adminService.getServiceBySlug(slug);
  }

  @Put('services/:slug/detail')
  async updateServiceBySlug(@Param('slug') slug: string, @Body() body: any) {
    return this.adminService.updateServiceBySlug(slug, body);
  }

  @Get('services/:id')
  async getService(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getService(id);
  }

  @Post('services')
  async createService(@Body() body: any) {
    return this.adminService.createService(body);
  }

  @Put('services/:id')
  async updateService(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateService(id, body);
  }

  @Patch('services/:id')
  async patchService(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.patchService(id, body);
  }

  @Delete('services/:id')
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteService(id);
  }

  @Put('services/:id/status')
  async updateServiceStatus(@Param('id', ParseIntPipe) id: number, @Body('is_active') isActive: boolean) {
    return this.adminService.updateServiceStatus(id, isActive);
  }

  @Put('services/:id/popular')
  async updateServicePopular(@Param('id', ParseIntPipe) id: number, @Body('is_popular') isPopular: boolean) {
    return this.adminService.updateServicePopular(id, isPopular);
  }

  // -------------------------------------------------------------------------
  // Team
  // -------------------------------------------------------------------------
  @Get('team')
  async listTeam() {
    return this.adminService.listTeam();
  }

  @Get('team/:id')
  async getTeam(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getTeam(id);
  }

  @Post('team')
  async createTeam(@Body() body: any) {
    return this.adminService.createTeam(body);
  }

  @Put('team/:id')
  async updateTeam(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateTeam(id, body);
  }

  @Delete('team/:id')
  async deleteTeam(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteTeam(id);
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------
  @Get('reviews')
  async listReviews(@Query() query: any) {
    return this.adminService.listReviews(query);
  }

  @Put('reviews/:id/status')
  async updateReviewStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.adminService.updateReviewStatus(id, status);
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteReview(id);
  }

  // -------------------------------------------------------------------------
  // Content management
  // -------------------------------------------------------------------------
  @Get('content-management')
  async getContentManagement() {
    return this.adminService.getContentManagement();
  }

  @Put('content-management')
  async updateContentManagement(@Body() body: any) {
    return this.adminService.updateContentManagement(body);
  }

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------
  @Post('contacts')
  async createContact(@Body() body: any, @Req() req: RequestWithUser) {
    return this.adminService.createContact(body, req.user.id);
  }

  @Get('contacts')
  async listContacts(@Query() query: any) {
    return this.adminService.listContacts(query);
  }

  @Get('contacts/search')
  async searchContacts(@Query() query: any) {
    return this.adminService.searchContacts(query);
  }

  @Get('contacts/stats')
  async contactStats() {
    return this.adminService.contactStats();
  }

  @Get('contacts/customer-stats')
  async customerStats() {
    return this.adminService.customerStats();
  }

  @Get('contacts/agents')
  async listAgents() {
    return this.adminService.listAgents();
  }

  @Get('contacts/:id')
  async getContact(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getContact(id);
  }

  @Put('contacts/:id/status')
  async updateContactStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.adminService.updateContactStatus(id, status);
  }

  @Put('contacts/:id/priority')
  async updateContactPriority(@Param('id', ParseIntPipe) id: number, @Body('priority') priority: string) {
    return this.adminService.updateContactPriority(id, priority);
  }

  @Put('contacts/:id/assign')
  async assignContact(@Param('id', ParseIntPipe) id: number, @Body('assigned_to') assignedTo: number) {
    return this.adminService.assignContact(id, assignedTo);
  }

  @Put('contacts/:id')
  async updateContact(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateContact(id, body);
  }

  @Put('contacts/:id/notes')
  async updateContactNotes(@Param('id', ParseIntPipe) id: number, @Body('notes') notes: string) {
    return this.adminService.updateContactNotes(id, notes);
  }

  @Get('contacts/:id/clients')
  async getContactClients(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getContactClients(id);
  }

  @Post('contacts/:id/promote-to-agent')
  async promoteToAgent(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.promoteToAgent(id);
  }

  @Post('contacts/:id/log-contact')
  async logContact(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.adminService.logContact(id, body, req.user.id);
  }

  @Get('contacts/:id/interactions')
  async getContactInteractions(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getContactInteractions(id);
  }

  @Put('contacts/:id/commission')
  async updateContactCommission(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminService.updateContactCommission(id, body);
  }

  @Get('contacts/export')
  async exportContacts() {
    return this.adminService.exportContacts();
  }

  @Post('contacts/:id/avatar')
  async updateContactAvatar(@Param('id', ParseIntPipe) id: number, @Body('avatar_url') avatarUrl: string) {
    return this.adminService.updateContactAvatar(id, avatarUrl);
  }

  @Delete('contacts/:id')
  async deleteContact(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteContact(id);
  }

  // -------------------------------------------------------------------------
  // Contact documents
  // -------------------------------------------------------------------------
  @Get('contacts/:id/documents')
  async listContactDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.listContactDocuments(id);
  }

  @Post('contacts/:id/documents')
  async createContactDocument(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: RequestWithUser) {
    return this.adminService.createContactDocument(id, body, req.user.id);
  }

  @Delete('contacts/:contactId/documents/:docId')
  async deleteContactDocument(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Param('docId', ParseIntPipe) docId: number,
  ) {
    return this.adminService.deleteContactDocument(contactId, docId);
  }

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------
  @Put('companies/:id/assign-agent')
  async assignAgentToCompany(
    @Param('id', ParseIntPipe) companyId: number,
    @Body('contact_id') contactId: number,
  ) {
    return this.adminService.assignAgentToCompany(companyId, contactId);
  }

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  @Get('orders')
  async listOrders(@Query() query: any) {
    return this.adminService.listOrders(query);
  }

  @Put('orders/:id/status')
  async updateOrderStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.adminService.updateOrderStatus(id, status);
  }

  @Get('orders/:id')
  async getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getOrder(id);
  }

  @Delete('orders/:id')
  async deleteOrder(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteOrder(id);
  }

  @Delete('orders')
  async deleteOrders(@Query() query: any) {
    return this.adminService.deleteOrders(query);
  }

  // -------------------------------------------------------------------------
  // Scheduled posts
  // -------------------------------------------------------------------------
  @Get('scheduled-posts')
  async listScheduledPosts() {
    return this.adminService.listScheduledPosts();
  }

  @Post('scheduled-posts/:id/publish')
  async publishScheduledPost(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.publishScheduledPost(id);
  }

  // -------------------------------------------------------------------------
  // Scheduler / cleanup / finance / agent requests
  // -------------------------------------------------------------------------
  @Get('scheduler/status')
  schedulerStatus() {
    return this.adminService.schedulerStatus();
  }

  @Get('cleanup/stats')
  async cleanupStats() {
    return this.adminService.cleanupStats();
  }

  @Post('cleanup/analytics')
  async cleanupAnalytics(@Body() body: any) {
    return this.adminService.cleanupAnalytics(body);
  }

  @Post('cleanup/notifications')
  async cleanupNotifications(@Body() body: any) {
    return this.adminService.cleanupNotifications(body);
  }

  @Post('cleanup/filtered-analytics')
  async cleanupFilteredAnalytics(@Body() body: any) {
    return this.adminService.cleanupFilteredAnalytics(body);
  }

  @Post('cleanup/run')
  async runCleanup() {
    return this.adminService.runCleanup();
  }

  @Get('finance/dashboard')
  async financeDashboard(@Query('period') period?: string) {
    return this.adminService.financeDashboard(period ? Number(period) : 0);
  }

  @Get('agent-requests')
  async listAgentRequests() {
    return this.adminService.listAgentRequests();
  }

  @Post('agent-requests/:id/approve')
  async approveAgentRequest(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.approveAgentRequest(id);
  }

  @Post('agent-requests/:id/dismiss')
  async dismissAgentRequest(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.dismissAgentRequest(id);
  }
}
