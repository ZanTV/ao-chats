import React, { useMemo, useState } from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from './Avatar';
import { ActionMenuSheet } from './ActionMenuSheet';
import { useSettingsStore } from '../stores/settingsStore';

type Props = {
  userId: string;
  avatarId: string;
  imageUrl?: string | null;
  imageVersion?: number | null;
  firstName?: string;
  lastName?: string;
  username?: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
};

/**
 * Shared profile-photo tap → action sheet → photo viewer.
 * Structured so a future "View Status" action can be added without redesign.
 */
export function ProfilePhotoActions({
  userId,
  avatarId,
  imageUrl,
  imageVersion,
  firstName,
  lastName,
  username,
  size = 48,
  showOnline,
  isOnline,
  isVerified,
  style,
  disabled,
}: Props) {
  const { colors, fonts, t } = useSettingsStore();
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => [
      {
        key: 'view',
        label: t.profile.viewProfilePhoto,
        onPress: () => {
          router.push({
            pathname: '/profile/photo-view',
            params: {
              userId,
              avatarId: avatarId || 'avatar-1',
              imageUrl: imageUrl || '',
              imageVersion: String(imageVersion ?? 0),
              firstName: firstName || '',
              lastName: lastName || '',
              username: username || '',
            },
          } as any);
        },
      },
      // Future: { key: 'status', label: t.profile.viewStatus, onPress: ... }
    ],
    [t, userId, avatarId, imageUrl, imageVersion, firstName, lastName, username]
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        activeOpacity={0.85}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t.profile.viewProfilePhoto}
        style={style}
      >
        <Avatar
          avatarId={avatarId || 'avatar-1'}
          imageUrl={imageUrl}
          imageVersion={imageVersion}
          size={size}
          showOnline={showOnline}
          isOnline={isOnline}
          isVerified={isVerified}
        />
      </TouchableOpacity>

      <ActionMenuSheet
        visible={open}
        title={t.profile.photoMenuTitle}
        items={items}
        onClose={() => setOpen(false)}
        colors={colors}
        fonts={fonts}
        cancelLabel={t.common.cancel}
      />
    </>
  );
}
