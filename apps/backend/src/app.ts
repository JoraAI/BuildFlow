/**
 * BuildFlow - Express app composition (no listen()).
 *
 * Separated from server.ts so supertest can import the app without binding a port.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimiter';
import { authRouter } from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import { projectRouter } from './routes/project.routes';
import { taskRouter, taskDetailRouter } from './routes/task.routes';
import { resourceRouter } from './routes/resource.routes';
import { boqRouter, boqDetailRouter } from './routes/boq.routes';
import { rateAnalysisRouter } from './routes/rate-analysis.routes';
import { estimateRouter } from './routes/estimate.routes';
import { reportRouter, reportDetailRouter } from './routes/daily-report.routes';
import { invoiceRouter, invoiceProjectRouter } from './routes/invoice.routes';
import { billRouter, billProjectRouter } from './routes/bill.routes';
import financialReportRouter from './routes/financial-report.routes';
import chatbotRouter from './routes/chatbot.routes';
import notificationRouter from './routes/notification.routes';
import paymentRouter from './routes/payment.routes';
import pdfReportRouter from './routes/pdf-report.routes';
import analyticsRouter from './routes/analytics.routes';
import settingsRouter from './routes/settings.routes';
import platformRouter from './routes/platform.routes';
import { changeOrderRouter } from './routes/change-order.routes';
import { procurementRouter } from './routes/procurement.routes';
import { subcontractProjectRouter, subcontractorRouter } from './routes/subcontract.routes';
import { subPortalPublicRouter } from './routes/subcontract-portal.routes';
import { portalPublicRouter, portalProjectRouter } from './routes/portal.routes';
import { proposalRouter } from './routes/proposal.routes';

const app = express();

// FIX (SEC-H3): trust the first proxy hop so `req.ip` resolves the real client
// IP from X-Forwarded-For safely (Express validates the hop count). Without
// this, req.ip is always the proxy and the rate limiter can't discriminate IPs.
app.set('trust proxy', 1);

// --- Security & infra middleware ---
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
app.use(compression());

// Capture RAW body for payment webhooks BEFORE json parsing (needed for HMAC verify).
app.use('/api/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/webhooks/saas', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/webhooks/stripe', express.raw({ type: '*/*', limit: '1mb' }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP request logging (morgan -> winston stream)
const stream = { write: (msg: string) => logger.info(msg.trim()) };
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream,
    skip: (req) => req.path === '/health',
  }),
);

// --- Health (no rate limit) ---
app.use('/health', healthRouter);

// --- Global API rate limit ---
app.use('/api', apiLimiter);

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/projects', taskRouter); // project-scoped: /:id/tasks, /:id/gantt
app.use('/api/tasks', taskDetailRouter);
app.use('/api/resources', resourceRouter);
app.use('/api/projects', boqRouter); // project-scoped: /:id/boq
app.use('/api/boq', boqDetailRouter);
app.use('/api/rate-analysis', rateAnalysisRouter);
app.use('/api', estimateRouter); // /projects/:id/estimates + /estimates/:id/...
app.use('/api/projects', reportRouter); // project-scoped: /:id/reports, /:id/checkin
app.use('/api/reports', reportDetailRouter);
app.use('/api/projects', invoiceProjectRouter); // project-scoped: /:id/invoices
app.use('/api/invoices', invoiceRouter);
app.use('/api/projects', billProjectRouter); // project-scoped: /:id/bills
app.use('/api/bills', billRouter);
app.use('/api', financialReportRouter); // project + company financial reports
app.use('/api/chatbot', chatbotRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api', paymentRouter); // /invoices/:id/payment-link + /webhooks/razorpay
app.use('/api/reports/pdf', pdfReportRouter); // 12 PDF report downloads
app.use('/api/analytics', analyticsRouter); // OWNER-only dashboard
app.use('/api/settings', settingsRouter); // company profile, users, audit log
app.use('/api/platform', platformRouter); // BuildFlow internal admin
app.use('/api/projects', changeOrderRouter); // /:id/change-orders
app.use('/api/projects', procurementRouter); // /:id/procurement/*
app.use('/api/projects', subcontractProjectRouter); // /:id/subcontract/*
app.use('/api/subcontractors', subcontractorRouter);
app.use('/api/projects', portalProjectRouter); // /:id/portal-access
app.use('/api/portal', portalPublicRouter); // public /:token
app.use('/api/portal/sub', subPortalPublicRouter); // subcontractor portal
app.use('/api/proposals', proposalRouter);

// --- 404 + error handler (last) ---
app.use(notFoundHandler);
app.use(errorHandler);

export { app };