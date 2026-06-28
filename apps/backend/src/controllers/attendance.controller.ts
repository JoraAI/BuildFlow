/**
 * BuildFlow - Attendance controller (thin request handlers).
 */
import { NextFunction, Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import { ok, created } from '../utils/response';

function ipOf(req: Request): string | undefined {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') return xfwd.split(',')[0]!.trim();
  return req.ip;
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await attendanceService.checkIn(
      companyId,
      userId,
      req.params.id,
      req.body,
      ipOf(req),
    );
    created(res, item);
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    const { companyId, id: userId } = req.user!;
    const item = await attendanceService.checkOut(companyId, userId, req.params.id, ipOf(req));
    ok(res, item);
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendanceService.listAttendance(req.user!.companyId, req.params.id, {
      date: req.query.date as string | undefined,
      userId: req.query.userId as string | undefined,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
}