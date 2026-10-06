/**
 * Public Terms of Service — required for Twilio A2P / app store compliance.
 * URL: https://build-flow-frontend-jet.vercel.app/terms
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

export default function TermsOfServicePage() {
  return (
    <MarketingPageShell>
      <MarketingSection
        title="Terms of Service"
        subtitle={`BuildFlow (“Service”) by Jora AI. Last updated: ${LAST_UPDATED}.`}
      >
        <P>
          These Terms govern access to and use of BuildFlow at
          https://build-flow-frontend-jet.vercel.app/ and related APIs, including Construction ERP
          and Inventory features. By creating an account, accepting an invite, or using the Service,
          you agree to these Terms and our Privacy Policy at
          https://build-flow-frontend-jet.vercel.app/privacy .
        </P>

        <View className="h-4" />

        <PolicyBlock title="1. The Service">
          <P>
            BuildFlow provides business software for construction and inventory operations
            (projects, stock, procurement, invoicing, reports, and related tools). Features depend
            on your subscription plan and company configuration.
          </P>
        </PolicyBlock>

        <PolicyBlock title="2. Accounts and eligibility">
          <P>
            You must provide accurate registration information. You are responsible for activity
            under your account and for keeping credentials and OTP access secure.
          </P>
          <P>
            Company owners/admins may invite users by email or mobile number. Invited users must
            complete verification (including OTP where applicable) before accessing the workspace.
          </P>
        </PolicyBlock>

        <PolicyBlock title="3. SMS authentication">
          <P>
            By providing your mobile number and requesting an OTP on screens such as
            https://build-flow-frontend-jet.vercel.app/login or
            https://build-flow-frontend-jet.vercel.app/signup/invite , you consent to receive
            transactional SMS one-time passcodes from BuildFlow for authentication and invite
            acceptance only.
          </P>
          <P>
            Message frequency varies based on your verification requests. Message and data rates may
            apply. Reply STOP to opt out; reply HELP for help. Carriers are not liable for delayed or
            undelivered messages. We do not send marketing SMS under this consent.
          </P>
        </PolicyBlock>

        <PolicyBlock title="4. Acceptable use">
          <P>
            You may not misuse the Service, attempt unauthorized access, reverse engineer except
            where allowed by law, upload unlawful content, or use the Service to violate applicable
            laws (including telecom, privacy, and tax rules).
          </P>
          <P>
            You are responsible for the accuracy of business records you enter (invoices, GST
            details, stock, etc.) and for compliance with laws that apply to your business.
          </P>
        </PolicyBlock>

        <PolicyBlock title="5. Customer data">
          <P>
            You retain rights to the business content you submit. You grant us a limited license to
            host, process, and display that content solely to provide and improve the Service.
          </P>
          <P>
            Organization admins control user access within their tenant. We process personal data as
            described in the Privacy Policy.
          </P>
        </PolicyBlock>

        <PolicyBlock title="6. Subscriptions and fees">
          <P>
            Paid plans, limits, and billing terms are shown in-product (for example Pricing and
            Billing settings). Fees, if any, are charged according to the plan you select. Failure to
            pay may result in suspension or reduced access.
          </P>
        </PolicyBlock>

        <PolicyBlock title="7. Intellectual property">
          <P>
            BuildFlow software, branding, and documentation remain owned by Jora AI / BuildFlow
            licensors. These Terms do not transfer ownership of our IP to you.
          </P>
        </PolicyBlock>

        <PolicyBlock title="8. Disclaimer">
          <P>
            The Service is provided “as is” to the extent permitted by law. We do not warrant
            uninterrupted or error-free operation. You use business outputs (reports, invoices,
            calculations) at your own risk and should verify critical figures.
          </P>
        </PolicyBlock>

        <PolicyBlock title="9. Limitation of liability">
          <P>
            To the maximum extent permitted by law, we are not liable for indirect, incidental,
            special, consequential, or lost-profit damages, or for losses arising from your data,
            downtime, or third-party services (including carriers and SMS delivery).
          </P>
        </PolicyBlock>

        <PolicyBlock title="10. Termination">
          <P>
            You may stop using the Service at any time. We may suspend or terminate access for
            violation of these Terms, non-payment, or risk to the Service or other users.
          </P>
        </PolicyBlock>

        <PolicyBlock title="11. Changes">
          <P>
            We may update these Terms. The “Last updated” date will change when we do. Continued use
            after changes constitutes acceptance of the updated Terms.
          </P>
        </PolicyBlock>

        <PolicyBlock title="12. Contact">
          <P>
            Questions: use in-app support / tickets, or contact your organization admin. Privacy
            Policy: https://build-flow-frontend-jet.vercel.app/privacy · Terms:
            https://build-flow-frontend-jet.vercel.app/terms
          </P>
        </PolicyBlock>
      </MarketingSection>
    </MarketingPageShell>
  );
}
