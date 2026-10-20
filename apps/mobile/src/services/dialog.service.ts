import React from 'react';
import { CustomModalType } from '../components/CustomModal';

export interface DialogOptions {
  type?: CustomModalType;
  title: string;
  message?: string;
  primaryText?: string;
  secondaryText?: string;
  onPrimary?: () => Promise<void> | void;
  onSecondary?: () => void;
  onDismiss?: () => void;
  isDestructive?: boolean;
  dismissable?: boolean;
  icon?: React.ReactNode;
  autoDismissMs?: number;
}

export interface DialogButton {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

type DialogDelegate = {
  show: (options: DialogOptions) => void;
  hide: () => void;
};

export interface DialogSuccessOptions {
  onConfirm?: () => void;
  confirmText?: string;
  autoDismissMs?: number;
}

export interface DialogErrorOptions {
  onDismiss?: () => void;
  dismissText?: string;
}

export interface DialogWarningOptions {
  onContinue?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  continueText?: string;
  cancelText?: string;
  confirmText?: string;
}

export interface DialogConfirmOptions {
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export interface DialogInfoOptions {
  onDismiss?: () => void;
  dismissText?: string;
  confirmText?: string;
}

class DialogService {
  private delegate: DialogDelegate | null = null;
  private queue: DialogOptions[] = [];
  private activeDialog: DialogOptions | null = null;

  setDelegate(delegate: DialogDelegate | null) {
    this.delegate = delegate;
    if (delegate && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.show(next);
      }
    }
  }

  show(options: DialogOptions) {
    if (this.delegate) {
      this.activeDialog = options;
      this.delegate.show(options);
    } else {
      this.queue.push(options);
    }
  }

  hide() {
    this.activeDialog = null;
    if (this.delegate) {
      this.delegate.hide();
    }
  }

  showSuccess(
    title: string,
    message?: string,
    onConfirmOrOptions?: (() => void) | DialogSuccessOptions,
    confirmText = 'Done'
  ) {
    if (typeof onConfirmOrOptions === 'object' && onConfirmOrOptions !== null) {
      this.show({
        type: 'success',
        title,
        message,
        primaryText: onConfirmOrOptions.confirmText || confirmText,
        onPrimary: onConfirmOrOptions.onConfirm,
        autoDismissMs: onConfirmOrOptions.autoDismissMs
      });
      return;
    }
    this.show({
      type: 'success',
      title,
      message,
      primaryText: confirmText,
      onPrimary: onConfirmOrOptions
    });
  }

  showError(
    title: string,
    message?: string,
    onDismissOrOptions?: (() => void) | DialogErrorOptions,
    dismissText = 'OK'
  ) {
    if (typeof onDismissOrOptions === 'object' && onDismissOrOptions !== null) {
      this.show({
        type: 'error',
        title,
        message,
        primaryText: onDismissOrOptions.dismissText || dismissText,
        onPrimary: onDismissOrOptions.onDismiss
      });
      return;
    }
    this.show({
      type: 'error',
      title,
      message,
      primaryText: dismissText,
      onPrimary: onDismissOrOptions
    });
  }

  showWarning(
    title: string,
    message?: string,
    onContinueOrOptions?: (() => void) | DialogWarningOptions,
    onCancel?: () => void,
    continueText = 'Continue',
    cancelText = 'Cancel'
  ) {
    if (typeof onContinueOrOptions === 'object' && onContinueOrOptions !== null) {
      this.show({
        type: 'warning',
        title,
        message,
        primaryText: onContinueOrOptions.confirmText || onContinueOrOptions.continueText || continueText,
        secondaryText: onContinueOrOptions.cancelText || cancelText,
        onPrimary: onContinueOrOptions.onConfirm || onContinueOrOptions.onContinue,
        onSecondary: onContinueOrOptions.onCancel
      });
      return;
    }
    this.show({
      type: 'warning',
      title,
      message,
      primaryText: continueText,
      secondaryText: cancelText,
      onPrimary: onContinueOrOptions,
      onSecondary: onCancel
    });
  }

  showConfirm(
    title: string,
    message?: string,
    onConfirmOrOptions?: (() => Promise<void> | void) | DialogConfirmOptions,
    onCancel?: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false
  ) {
    if (typeof onConfirmOrOptions === 'object' && onConfirmOrOptions !== null) {
      this.show({
        type: 'confirmation',
        title,
        message,
        primaryText: onConfirmOrOptions.confirmText || confirmText,
        secondaryText: onConfirmOrOptions.cancelText || cancelText,
        onPrimary: onConfirmOrOptions.onConfirm,
        onSecondary: onConfirmOrOptions.onCancel,
        isDestructive: onConfirmOrOptions.isDestructive ?? isDestructive
      });
      return;
    }
    this.show({
      type: 'confirmation',
      title,
      message,
      primaryText: confirmText,
      secondaryText: cancelText,
      onPrimary: onConfirmOrOptions,
      onSecondary: onCancel,
      isDestructive
    });
  }

  showInfo(
    title: string,
    message?: string,
    onDismissOrOptions?: (() => void) | DialogInfoOptions,
    dismissText = 'OK'
  ) {
    if (typeof onDismissOrOptions === 'object' && onDismissOrOptions !== null) {
      this.show({
        type: 'info',
        title,
        message,
        primaryText: onDismissOrOptions.confirmText || onDismissOrOptions.dismissText || dismissText,
        onPrimary: onDismissOrOptions.onDismiss
      });
      return;
    }
    this.show({
      type: 'info',
      title,
      message,
      primaryText: dismissText,
      onPrimary: onDismissOrOptions
    });
  }

  // Convenient aliases
  error = this.showError.bind(this);
  success = this.showSuccess.bind(this);
  warning = this.showWarning.bind(this);
  confirm = this.showConfirm.bind(this);
  info = this.showInfo.bind(this);

  /**
   * Drop-in replacement for React Native's Alert.alert.
   * Maps buttons array to luxury custom modal with proper styling and callbacks.
   */
  alert(
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: { cancelable?: boolean }
  ) {
    // Determine type from title or content keywords
    const lowerTitle = (title || '').toLowerCase();
    const lowerMsg = (message || '').toLowerCase();
    let detectedType: CustomModalType = 'info';

    if (
      lowerTitle.includes('success') ||
      lowerTitle.includes('saved') ||
      lowerTitle.includes('updated') ||
      lowerTitle.includes('confirmed') ||
      lowerTitle.includes('created') ||
      lowerTitle.includes('resent') ||
      lowerTitle.includes('added') ||
      lowerTitle.includes('active')
    ) {
      detectedType = 'success';
    } else if (
      lowerTitle.includes('error') ||
      lowerTitle.includes('failed') ||
      lowerTitle.includes('invalid') ||
      lowerTitle.includes('blocked') ||
      lowerTitle.includes('denied') ||
      lowerTitle.includes('required') ||
      lowerTitle.includes('unable') ||
      lowerTitle.includes('limit')
    ) {
      detectedType = 'error';
    } else if (
      lowerTitle.includes('warning') ||
      lowerTitle.includes('alert') ||
      lowerTitle.includes('caution') ||
      lowerTitle.includes('attention')
    ) {
      detectedType = 'warning';
    }

    if (!buttons || buttons.length === 0) {
      this.show({
        type: detectedType,
        title,
        message,
        primaryText: 'OK',
        dismissable: options?.cancelable ?? true
      });
      return;
    }

    // If multiple buttons provided (e.g. Cancel and Confirm/Delete/Logout)
    if (buttons.length >= 2) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
      const actionBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];
      const isDestructive =
        actionBtn.style === 'destructive' ||
        lowerTitle.includes('delete') ||
        lowerTitle.includes('cancel') ||
        lowerTitle.includes('logout') ||
        lowerTitle.includes('remove') ||
        lowerMsg.includes('delete') ||
        lowerMsg.includes('permanent');

      this.show({
        type: 'confirmation',
        title,
        message,
        primaryText: actionBtn.text || 'Confirm',
        secondaryText: cancelBtn.text || 'Cancel',
        isDestructive,
        onPrimary: actionBtn.onPress,
        onSecondary: cancelBtn.onPress,
        dismissable: options?.cancelable ?? true
      });
      return;
    }

    // Single button
    const singleBtn = buttons[0];
    const isDestructive = singleBtn.style === 'destructive';
    this.show({
      type: detectedType,
      title,
      message,
      primaryText: singleBtn.text || 'OK',
      isDestructive,
      onPrimary: singleBtn.onPress,
      dismissable: options?.cancelable ?? true
    });
  }
}

export const dialogService = new DialogService();
