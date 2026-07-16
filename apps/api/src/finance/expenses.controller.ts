import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { ExpensesService } from './expenses.service';
import {
  AddReceiptToExpenseDto,
  AddToInvoiceDto,
  CreateExpenseDto,
  CreateExpenseFromReceiptDto,
  CreateReceiptDto,
  GetExpensesQueryDto,
  GetReceiptsQueryDto,
  LinkReceiptToExpenseDto,
  ReimburseExpenseDto,
  RejectExpenseDto,
  UpdateExpenseDto,
  UpdateReceiptDto,
} from './dto/expenses.dto';
import { setNoCache } from './finance-utils';

@Controller('expenses')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('stats')
  async getStats(@Query() query: { start_date?: string; end_date?: string }, @Res() res: Response) {
    setNoCache(res);
    const data = await this.expensesService.getStats(query.start_date, query.end_date);
    return res.json({ success: true, data });
  }

  @Get('pending')
  @Roles('admin', 'manager')
  async findPending(@Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findPendingApproval());
  }

  @Get('reimbursable')
  async findReimbursable(@Res() res: Response, @Query('employee_id') employeeId?: string) {
    setNoCache(res);
    const data = await this.expensesService.findReimbursable(employeeId ? parseInt(employeeId, 10) : undefined);
    return res.json(data);
  }

  @Get('billable')
  async findBillable(
    @Res() res: Response,
    @Query('contact_id') contactId?: string,
    @Query('company_id') companyId?: string,
  ) {
    setNoCache(res);
    const data = await this.expensesService.findBillable(
      contactId ? parseInt(contactId, 10) : undefined,
      companyId ? parseInt(companyId, 10) : undefined,
    );
    return res.json(data);
  }

  @Get()
  async findAll(@Query() query: GetExpensesQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findAll(query as unknown as Record<string, unknown>, req.user));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findOne(id, req.user));
  }

  @Post()
  async create(@Body() dto: CreateExpenseDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.expensesService.create(req.user.id, dto as unknown as Record<string, unknown>);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.update(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.remove(id, req.user));
  }

  @Post(':id/approve')
  @Roles('admin', 'manager')
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.approve(id, req.user.id));
  }

  @Post(':id/reject')
  @Roles('admin', 'manager')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectExpenseDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.reject(id, req.user.id, dto.reason));
  }

  @Post(':id/reimburse')
  @Roles('admin', 'manager')
  async reimburse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReimburseExpenseDto,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.reimburse(id, dto.reference));
  }

  @Post(':id/add-to-invoice')
  async addToInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddToInvoiceDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.addToInvoice(id, dto.invoice_id, req.user));
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.duplicate(id, req.user.id));
  }

  @Post(':id/add-receipt')
  async addReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddReceiptToExpenseDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.addReceipt(id, dto, req.user));
  }

  // Receipts

  @Get('receipts/list')
  async findReceipts(@Query() query: GetReceiptsQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findReceipts(query, req.user));
  }

  @Get('receipts/unmatched')
  async findUnmatchedReceipts(@Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findUnmatchedReceipts());
  }

  @Get('receipts/stats')
  async getReceiptStats(@Query() query: { start_date?: string; end_date?: string }, @Res() res: Response) {
    setNoCache(res);
    const data = await this.expensesService.getReceiptStats(query.start_date, query.end_date);
    return res.json({ success: true, data });
  }

  @Get('receipts/:id')
  async findReceipt(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.findReceipt(id, req.user));
  }

  @Post('receipts')
  async createReceipt(@Body() dto: CreateReceiptDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.expensesService.createReceipt(req.user.id, dto as unknown as Record<string, unknown>);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put('receipts/:id')
  async updateReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReceiptDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.updateReceipt(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Delete('receipts/:id')
  async removeReceipt(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.removeReceipt(id, req.user));
  }

  @Post('receipts/:id/link-expense')
  async linkReceiptToExpense(
    @Param('id', ParseIntPipe) receiptId: number,
    @Body() dto: LinkReceiptToExpenseDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.linkReceiptToExpense(receiptId, dto.expense_id, req.user));
  }

  @Post('receipts/:id/unlink')
  async unlinkReceipt(@Param('id', ParseIntPipe) receiptId: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.expensesService.unlinkReceipt(receiptId, req.user));
  }

  @Post('receipts/:id/create-expense')
  async createExpenseFromReceipt(
    @Param('id', ParseIntPipe) receiptId: number,
    @Body() dto: CreateExpenseFromReceiptDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.expensesService.createExpenseFromReceipt(receiptId, req.user, dto as unknown as Record<string, unknown>));
  }
}
