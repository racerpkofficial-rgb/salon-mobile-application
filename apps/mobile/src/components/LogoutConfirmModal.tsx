import React from 'react';
import { CustomModal } from './CustomModal';

interface LogoutConfirmModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function LogoutConfirmModal({
  visible,
  onCancel,
  onConfirm
}: LogoutConfirmModalProps) {
  return (
    <CustomModal
      visible={visible}
      type="confirmation"
      isDestructive
      title="Log out of Account?"
      message="Are you sure you want to log out of your session? You can sign back in anytime."
      primaryText="Log out"
      secondaryText="Cancel"
      onPrimary={onConfirm}
      onSecondary={onCancel}
      onDismiss={onCancel}
    />
  );
}
