/**
 * Public Privacy Policy — required for Twilio A2P / app store compliance.
 * URL: https://build-flow-frontend-jet.vercel.app/privacy
 */
import React from 'react';
import { Text, View } from 'react-native';
import { MarketingPageShell } from '@/components/marketing/MarketingPageShell';
import { MarketingSection } from '@/components/marketing/MarketingSection';
import { Card } from '@/components/ui';

const LAST_UPDATED = '6 October 2026';

function PolicyBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <Text className="text-base font-bold text-text mb-2">{title}</Text>
      <View className="gap-2">{children}</View>
    </Card>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-muted leading-relaxed">{children}</Text>;
}

export default function PrivacyPolicyPage() {
  return (
    <MarketingPageShell>
      <MarketingSection
        title="Privacy Policy"
        subtitle={`StaffingPros and Jora AI (“we”, “us”, “our”), operating the BuildFlow platform. Last updated: ${LAST_UPDATED}.`}
      >
        <P>
          This Privacy Policy explains how StaffingPros and Jora AI collect, use, store, and share
          information when you use the BuildFlow business software platform at
          https://build-flow-frontend-jet.vercel.app/ (the “Service”), including SMS one-time
          passcodes (OTPs) used for login and invite verification. BuildFlow is a product operated
          by StaffingPros and Jora AI.
        </P>

        <View className="h-4" />

        <PolicyBlock title="1. Information we collect">
          <P>
            Account and profile data such as name, email address, mobile phone number, company name,
            role, and authentication credentials.
          </P>
          <P>
            Business / operational data you enter in the Service (for example projects, stock,
            invoices, parties, staffing/workforce records, and related documents).
          </P>
          <P>
            Technical data such as device/browser type, IP address, app version, and logs needed to
            secure and operate the Service.
          </P>
          <P>
            Communications data when you contact support or when we send transactional messages
            (email or SMS OTPs).
          </P>
        </PolicyBlock>

        <PolicyBlock title="2. How we use information">
          <P>To create and manage your account and company workspace.</P>
          <P>
            To authenticate you via email or SMS OTP when you request a code on login or invite
            acceptance screens after providing SMS consent.
          </P>
          <P>
            To provide BuildFlow ERP / Inventory and related business features you request (stock,
            sales, billing, reports, workforce/operations tools).
          </P>
          <P>To secure the Service, prevent abuse, troubleshoot issues, and meet legal obligations.</P>
          <P>We do not sell your personal information.</P>
        </PolicyBlock>

        <PolicyBlock title="3. SMS / OTP messaging">
          <P>
            If you provide a mobile number, check the SMS consent box, and request an OTP (for
            example on https://build-flow-frontend-jet.vercel.app/login ,
            https://build-flow-frontend-jet.vercel.app/signup/invite , or as shown on
            https://build-flow-frontend-jet.vercel.app/sms-opt-in), StaffingPros / Jora AI send
            transactional SMS authentication codes only. We do not use that consent for promotional
            or marketing SMS.
          </P>
          <P>
            Message frequency is low and based on your login or invite verification actions. Message
            and data rates may apply. Reply STOP to opt out of SMS; reply HELP for help. Carriers are
            not liable for delayed or undelivered messages.
          </P>
        </PolicyBlock>

        <PolicyBlock title="4. Sharing of information">
          <P>
            We may share data with service providers who help us operate the Service (for example
            hosting, email delivery, and SMS providers such as Twilio), under contracts that limit
            use to providing those services.
          </P>
          <P>
            Within your company workspace, authorized users of your organization can access
            business data according to their roles and permissions.
          </P>
          <P>We may disclose information if required by law or to protect rights, safety, or security.</P>
        </PolicyBlock>

        <PolicyBlock title="5. Data retention">
          <P>
            We retain account and business data while your organization uses the Service and as
            needed for backups, disputes, security, and legal compliance. You may request deletion
            subject to applicable law and legitimate retention needs.
          </P>
        </PolicyBlock>

        <PolicyBlock title="6. Security">
          <P>
            We use industry-standard measures such as encrypted transport (HTTPS), access controls,
            and authenticated APIs. No method of transmission or storage is 100% secure.
          </P>
        </PolicyBlock>

        <PolicyBlock title="7. Your choices">
          <P>Update profile details in the app where available.</P>
          <P>Opt out of SMS by replying STOP to our OTP messages.</P>
          <P>
            Contact us to request access, correction, or deletion of personal data where applicable.
          </P>
        </PolicyBlock>

        <PolicyBlock title="8. Children">
          <P>
            The Service is intended for business use by adults. We do not knowingly collect personal
            information from children.
          </P>
        </PolicyBlock>

        <PolicyBlock title="9. Changes">
          <P>
            We may update this Policy from time to time. The “Last updated” date at the top will
            change when we do. Continued use of the Service after changes means you accept the
            updated Policy.
          </P>
        </PolicyBlock>

        <PolicyBlock title="10. Contact">
          <P>
            Questions about this Privacy Policy for StaffingPros, Jora AI, or BuildFlow: contact your
            organization admin or email support through the in-app support / tickets channel. Legal
            pages: Privacy https://build-flow-frontend-jet.vercel.app/privacy · Terms
            https://build-flow-frontend-jet.vercel.app/terms · SMS opt-in
            https://build-flow-frontend-jet.vercel.app/sms-opt-in
          </P>
        </PolicyBlock>
      </MarketingSection>
    </MarketingPageShell>
  );
}
