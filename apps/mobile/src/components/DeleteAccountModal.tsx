import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { dialogService } from '../services/dialog.service';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteAccountModal({
  visible,
  onClose,
  onSuccess
}: DeleteAccountModalProps) {
  const { user, token } = useAuth();
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.role === 'SALON_OWNER';

  const handleClose = () => {
    setConfirmInput('');
    onClose();
  };

  const handleDelete = async () => {
    if (!token) return;

    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      dialogService.error('Confirmation Required', 'Please type DELETE in all capital letters to confirm.');
      return;
    }

    setDeleting(true);
    try {
      const res = await authService.deleteAccount(token);
      dialogService.showSuccess('Account Deleted', res.message, () => {
        handleClose();
        onSuccess();
      });
    } catch (e) {
      dialogService.error(
        'Deletion Blocked',
        e instanceof Error
          ? e.message
          : 'Unable to process account deletion. Please check for active bookings and try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={s.backdrop}>
        <View style={s.modalCard}>
          {/* Warning Icon */}
          <View style={s.iconWrap}>
            <Text style={s.icon}>⚠️</Text>
          </View>

          <Text style={s.title}>Delete Account Permanently?</Text>
          <Text style={s.warningSubtitle}>
            This action is irreversible and permanently deletes your Book My Salon account.
          </Text>

          <View style={s.impactBox}>
            <Text style={s.impactHeading}>What will happen:</Text>
            <Text style={s.impactText}>
              • Your profile information, personal address, and saved salons will be deleted.{'\n'}
              • Your push notification tokens will be unregistered.{'\n'}
              {isOwner ? (
                <>
                  • Your salon establishment will be deactivated and removed from public discovery.{'\n'}
                  • Any active partner subscription will be immediately canceled.{'\n'}
                  • Deletion will fail if you have active upcoming bookings with customers.
                </>
              ) : (
                <>
                  • Your past appointment history will no longer be accessible.{'\n'}
                  • Deletion will fail if you have pending or confirmed upcoming bookings.
                </>
              )}
            </Text>
          </View>

          <Text style={s.instruction}>
            Type <Text style={s.bold}>DELETE</Text> below to confirm:
          </Text>
          <TextInput
            style={s.input}
            value={confirmInput}
            onChangeText={setConfirmInput}
            placeholder="DELETE"
            placeholderTextColor={colors.subtle}
            autoCapitalize="characters"
          />

          <View style={s.btnRow}>
            <Pressable
              onPress={handleClose}
              disabled={deleting}
              style={s.cancelBtn}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              disabled={deleting || confirmInput.trim().toUpperCase() !== 'DELETE'}
              style={[
                s.deleteBtn,
                (deleting || confirmInput.trim().toUpperCase() !== 'DELETE') && { opacity: 0.5 }
              ]}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.deleteBtnText}>Permanently Delete</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 10, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  icon: {
    fontSize: 28
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D32F2F',
    textAlign: 'center'
  },
  warningSubtitle: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16
  },
  impactBox: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: radius.md,
    padding: 12,
    width: '100%',
    marginBottom: 16
  },
  impactHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 4
  },
  impactText: {
    fontSize: 11,
    lineHeight: 18,
    color: '#6D4C41'
  },
  instruction: {
    fontSize: 12,
    color: colors.ink,
    alignSelf: 'flex-start',
    marginBottom: 6
  },
  bold: {
    fontWeight: '800',
    color: '#D32F2F'
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#D32F2F',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 20
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink
  },
  deleteBtn: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
