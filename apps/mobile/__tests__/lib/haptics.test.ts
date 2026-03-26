import * as Haptics from 'expo-haptics'

import { hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics'

describe('haptics utility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hapticLight calls impactAsync with Light style', async () => {
    await hapticLight()
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
  })

  it('hapticMedium calls impactAsync with Medium style', async () => {
    await hapticMedium()
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
  })

  it('hapticSuccess calls notificationAsync with Success type', async () => {
    await hapticSuccess()
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    )
  })

  it('silently catches errors on simulator', async () => {
    ;(Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('Not available'))
    // Should not throw
    await expect(hapticLight()).resolves.toBeUndefined()
  })
})
