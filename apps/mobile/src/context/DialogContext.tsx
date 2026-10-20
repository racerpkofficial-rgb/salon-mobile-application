import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { CustomModal, CustomModalProps } from '../components/CustomModal';
import { dialogService, DialogOptions, DialogButton } from '../services/dialog.service';

interface DialogContextValue {
  showModal: (options: DialogOptions) => void;
  hideModal: () => void;
  showSuccess: (title: string, message?: string, onConfirm?: () => void, confirmText?: string) => void;
  showError: (title: string, message?: string, onDismiss?: () => void, dismissText?: string) => void;
  showWarning: (title: string, message?: string, onContinue?: () => void, onCancel?: () => void, continueText?: string, cancelText?: string) => void;
  showConfirm: (title: string, message?: string, onConfirm?: () => Promise<void> | void, onCancel?: () => void, confirmText?: string, cancelText?: string, isDestructive?: boolean) => void;
  showInfo: (title: string, message?: string, onDismiss?: () => void, dismissText?: string) => void;
  alert: (title: string, message?: string, buttons?: DialogButton[], options?: { cancelable?: boolean }) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [modalConfig, setModalConfig] = useState<DialogOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const hideModal = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setModalConfig(null);
    }, 200);
  }, []);

  const showModal = useCallback((options: DialogOptions) => {
    setModalConfig(options);
    setVisible(true);
  }, []);

  // Connect singleton dialogService to the React context state
  useEffect(() => {
    dialogService.setDelegate({
      show: (options) => {
        setModalConfig(options);
        setVisible(true);
      },
      hide: () => {
        setVisible(false);
        setTimeout(() => setModalConfig(null), 200);
      }
    });

    return () => {
      dialogService.setDelegate(null);
    };
  }, []);

  const showSuccess = useCallback(
    (title: string, message?: string, onConfirm?: () => void, confirmText = 'Done') => {
      showModal({
        type: 'success',
        title,
        message,
        primaryText: confirmText,
        onPrimary: onConfirm
      });
    },
    [showModal]
  );

  const showError = useCallback(
    (title: string, message?: string, onDismiss?: () => void, dismissText = 'OK') => {
      showModal({
        type: 'error',
        title,
        message,
        primaryText: dismissText,
        onPrimary: onDismiss
      });
    },
    [showModal]
  );

  const showWarning = useCallback(
    (
      title: string,
      message?: string,
      onContinue?: () => void,
      onCancel?: () => void,
      continueText = 'Continue',
      cancelText = 'Cancel'
    ) => {
      showModal({
        type: 'warning',
        title,
        message,
        primaryText: continueText,
        secondaryText: cancelText,
        onPrimary: onContinue,
        onSecondary: onCancel
      });
    },
    [showModal]
  );

  const showConfirm = useCallback(
    (
      title: string,
      message?: string,
      onConfirm?: () => Promise<void> | void,
      onCancel?: () => void,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDestructive = false
    ) => {
      showModal({
        type: 'confirmation',
        title,
        message,
        primaryText: confirmText,
        secondaryText: cancelText,
        onPrimary: onConfirm,
        onSecondary: onCancel,
        isDestructive
      });
    },
    [showModal]
  );

  const showInfo = useCallback(
    (title: string, message?: string, onDismiss?: () => void, dismissText = 'OK') => {
      showModal({
        type: 'info',
        title,
        message,
        primaryText: dismissText,
        onPrimary: onDismiss
      });
    },
    [showModal]
  );

  const alert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: DialogButton[],
      options?: { cancelable?: boolean }
    ) => {
      dialogService.alert(title, message, buttons, options);
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      showModal,
      hideModal,
      showSuccess,
      showError,
      showWarning,
      showConfirm,
      showInfo,
      alert
    }),
    [showModal, hideModal, showSuccess, showError, showWarning, showConfirm, showInfo, alert]
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {modalConfig && (
        <CustomModal
          visible={visible}
          type={modalConfig.type}
          title={modalConfig.title}
          message={modalConfig.message}
          primaryText={modalConfig.primaryText}
          secondaryText={modalConfig.secondaryText}
          onPrimary={async () => {
            if (modalConfig.onPrimary) {
              await modalConfig.onPrimary();
            }
            hideModal();
          }}
          onSecondary={() => {
            if (modalConfig.onSecondary) {
              modalConfig.onSecondary();
            }
            hideModal();
          }}
          onDismiss={() => {
            if (modalConfig.onDismiss) {
              modalConfig.onDismiss();
            }
            hideModal();
          }}
          isDestructive={modalConfig.isDestructive}
          dismissable={modalConfig.dismissable}
          icon={modalConfig.icon}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
