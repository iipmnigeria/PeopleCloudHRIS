import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type EmailNotificationPayload = {
  to: string;
  subject: string;
  html: string;
  companyId?: string | null;
  type?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Creates an email request document in Firestore.
 * The Firebase "Trigger Email from Firestore" extension should watch the `mail` collection
 * and send the actual email using the SMTP provider configured in Firebase.
 */
export async function queueEmailNotification({
  to,
  subject,
  html,
  companyId = null,
  type = 'general',
  metadata = {},
}: EmailNotificationPayload) {
  if (!to) {
    console.warn('Email notification skipped: missing recipient.');
    return;
  }

  await addDoc(collection(db, 'mail'), {
    to,
    message: {
      subject,
      html,
    },
    companyId,
    type,
    metadata,
    createdAt: serverTimestamp(),
  });
}

export async function sendCompanyWelcomeEmail(params: {
  to: string;
  displayName: string;
  companyName: string;
  plan: string;
  companyId: string;
}) {
  const { to, displayName, companyName, plan, companyId } = params;

  return queueEmailNotification({
    to,
    companyId,
    type: 'company_welcome',
    metadata: { companyName, plan },
    subject: 'Welcome to PeopleCloudHRIS — Your Workspace Is Ready',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto;">
        <h2 style="color:#0f172a; margin-bottom: 8px;">Welcome to PeopleCloudHRIS</h2>
        <p>Dear ${displayName},</p>
        <p>Your company workspace has been created successfully.</p>

        <table style="border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; width: 100%;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Company</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Plan</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${plan}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Trial</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">30 days</td>
          </tr>
        </table>

        <p>You can now sign in and begin setting up your employee records, leave management, attendance, payroll support, and HR requests.</p>

        <p style="margin: 24px 0;">
          <a href="https://iipmnigeria.github.io/PeopleCloudHRIS/"
             style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:8px;font-weight:bold;">
            Open PeopleCloudHRIS
          </a>
        </p>

        <p>Regards,<br/>PeopleCloudHRIS Team</p>
      </div>
    `,
  });
}

export async function sendLeaveRequestEmail(params: {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  companyId: string;
}) {
  const { to, employeeName, leaveType, startDate, endDate, companyId } = params;

  return queueEmailNotification({
    to,
    companyId,
    type: 'leave_request_submitted',
    metadata: { employeeName, leaveType, startDate, endDate },
    subject: `New Leave Request — ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>New Leave Request Submitted</h2>
        <p><strong>${employeeName}</strong> submitted a ${leaveType} request.</p>
        <p><strong>Start date:</strong> ${startDate}<br/><strong>End date:</strong> ${endDate}</p>
        <p>Please log in to PeopleCloudHRIS to review and take action.</p>
      </div>
    `,
  });
}

export async function sendHrRequestEmail(params: {
  to: string;
  requesterName: string;
  requestType: string;
  companyId: string;
}) {
  const { to, requesterName, requestType, companyId } = params;

  return queueEmailNotification({
    to,
    companyId,
    type: 'hr_request_submitted',
    metadata: { requesterName, requestType },
    subject: `New HR Request — ${requestType}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2>New HR Request</h2>
        <p><strong>${requesterName}</strong> submitted a new HR request.</p>
        <p><strong>Request type:</strong> ${requestType}</p>
        <p>Please log in to PeopleCloudHRIS to respond.</p>
      </div>
    `,
  });
}
