import * as Haptics from 'expo-haptics'

export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } catch {
    // Silently fail on simulator or unsupported devices
  }
}

export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  } catch {
    // Silently fail on simulator or unsupported devices
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    // Silently fail on simulator or unsupported devices
  }
}
