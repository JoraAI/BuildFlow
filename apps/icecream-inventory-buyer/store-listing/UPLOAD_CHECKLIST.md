# Jora Trade — Play Console upload checklist

Access model: **invite-only**. Buyers join with a code from their ice cream manufacturer / supplier. No public signup.

## A. Files to upload (this folder + assets)

| Play Console field | File |
|--------------------|------|
| App icon (512×512) | `../assets/play-icon-512.png` |
| Feature graphic (1024×500) | `feature/feature-graphic-1024x500.png` |
| Phone screenshots (2–8) | `phone/phone-1-1080x1920.png` … `phone-3-…` |
| 7″ tablet screenshots | `tablet-7/tablet7-1-1200x1920.png` … (or land variants) |
| 10″ tablet screenshots | `tablet-10/tablet10-1-1600x2560.png` … (or land variants) |
| Production AAB | See `builds/DOWNLOADS.md` after EAS build finishes |
| Store text | Paste from `PLAY_CONSOLE_COPY.txt` |

## B. Play Console steps

1. **Store presence → Main store listing**  
   - Paste name / short / full description from `PLAY_CONSOLE_COPY.txt`  
   - Upload icon, feature graphic, phone (+ tablet) screenshots  
   - Privacy policy URL from the copy file  

2. **Release → Testing → Internal testing → Create release**  
   - Upload the **production `.aab`** from Expo / `builds/`  
   - Package must be `com.joraai.joratrade`  
   - Release notes example: `Invite-only B2B ordering from your manufacturer catalog.`  
   - Add testers → Start rollout  

3. **Policy → App content**  
   - Privacy policy  
   - Data safety (account email/phone, orders; HTTPS; no ads; not for children)  
   - Ads: No  
   - Target audience: 18+ / business  
   - Content rating questionnaire  
   - SMS: transactional OTP only after join (see sms-opt-in URL)  

4. When internal QA passes → Closed testing / Production as required by your account.

## C. After each UI change

```bash
cd apps/icecream-inventory-buyer
npx eas build -p android --profile production
# then upload the new AAB (versionCode auto-bumps via EAS remote)
```
