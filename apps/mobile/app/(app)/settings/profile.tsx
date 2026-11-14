/**
 * BuildFlow - My Profile (Construction ERP).
 * Name, email, and phone — contact changes require OTP.
 */
import React from 'react';
import { LoadingSkeleton } from '@/components/ui';
import { SettingsPageLayout } from '@/components/layout/SettingsPageLayout';
import { ProfileContactForm } from '@/components/settings/ProfileContactForm';
import { useMyProfile } from '@/services/settings.queries';

export default function MyProfileScreen() {
  const { data, isLoading } = useMyProfile();

  return (
    <SettingsPageLayout title="My Profile" subtitle="Name, email, and mobile for sign-in">
      {isLoading || !data ? <LoadingSkeleton className="h-48" /> : <ProfileContactForm profile={data} />}
    </SettingsPageLayout>
  );
}
