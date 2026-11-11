# מדריך העלאה לחנויות – Temple 2048

המשחק ארוז עם Capacitor: תיקיית `android/` היא פרויקט Android Studio רגיל ותיקיית `ios/` היא פרויקט Xcode רגיל.
כל שינוי בקוד המשחק מגיע אליהם עם:

```bash
npm run cap:sync
```

לפני ההעלאה הראשונה כדאי להחליט סופית על שם ומזהה חבילה. כרגע: שם `Temple 2048`, מזהה `co.shortforge.temple2048`
(ב‑`capacitor.config.ts` וב‑`src/game/Config.ts`). את המזהה אי אפשר לשנות אחרי הפרסום. לא להשתמש במילה Zuma בשם, זה סימן מסחרי.

---

## חלק א' – Google Play (אפשר לעשות הכל מהמחשב הזה)

### 1. חשבון מפתח
- https://play.google.com/console – תשלום חד‑פעמי של 25$. אימות זהות לוקח יום‑יומיים.

### 2. התקנת Android Studio
- להוריד מ‑https://developer.android.com/studio ולהתקין עם ברירות המחדל (כולל Android SDK ו‑JDK).
- לפתוח את הפרויקט:

```bash
npm run cap:android
```

- Android Studio יבצע Gradle Sync (בפעם הראשונה כמה דקות). אפשר להריץ על אמולטור או על טלפון אנדרואיד ב‑USB (להפעיל Developer options > USB debugging) כדי לראות את המשחק אמיתי.

### 3. חתימה (keystore) – פעם אחת בחיים של האפליקציה
- ב‑Android Studio: **Build > Generate Signed Bundle / APK > Android App Bundle > Create new…**
- לשמור את קובץ ה‑`.jks` והסיסמאות במקום בטוח (למשל 1Password + גיבוי). בלי הקובץ הזה אי אפשר לפרסם עדכונים לעולם.
- לבחור **release** וללחוץ Finish. מתקבל `android/app/release/app-release.aab`.

### 4. יצירת האפליקציה ב‑Play Console
1. **Create app** – שם, שפה, סוג: Game, חינמית.
2. **Dashboard** מראה רשימת משימות. למלא:
   - **App access** – אין צורך בהתחברות.
   - **Ads** – כרגע אין פרסומות.
   - **Content rating** – שאלון קצר (משחק פאזל, ללא אלימות) → דירוג "Everyone".
   - **Target audience** – 13+ (ככה לא נכנסים לדרישות "Designed for Families").
   - **Data safety** – המשחק לא אוסף ולא שולח נתונים (שמירה מקומית בלבד).
   - **Privacy policy** – חובה קישור. העמוד מוכן: `https://shortforge.co/temple2048/privacy` (כבר באוויר) (המקור ב‑shorts-studio/public/temple2048/privacy.html, עולה לאוויר עם git push של אתר הנחיתה; עותק גם ב‑public/privacy.html בתיקיית המשחק).
   - **Store listing** – תיאור קצר (80 תווים), תיאור מלא, אייקון 512×512 (יש ב‑`assets/icon-only.png`, להקטין), Feature graphic 1024×500, לפחות 2 צילומי מסך טלפון (מומלץ 1080×1920).
3. **Testing > Internal testing** – להעלות את ה‑AAB, להוסיף את המייל שלך כבודק, ולהתקין מהקישור. זה גם הדרך לבדוק את כפתור "Rate us" (הוא פותח את דף המשחק ב‑Play).
4. **Production > Create new release** – אותו AAB, הערות גרסה, **Start rollout**. ביקורת ראשונה לוקחת בדרך כלל 1‑7 ימים.

### 5. צילומי מסך בלי טלפון
- להריץ `npm run dev`, לפתוח ב‑Chrome, F12 → Device toolbar → Pixel 7 (412×915) → Capture screenshot. או מהאמולטור ב‑Android Studio.

---

## חלק ב' – App Store (חובה Mac או שירות ענן)

### 1. מה צריך
- **Apple Developer Program** – 99$ לשנה, https://developer.apple.com/programs/ (אישור עד 48 שעות).
- **Mac עם Xcode** (גם Mac mini ישן / מושאל מספיק), **או** שירות בנייה בענן:
  - Codemagic (https://codemagic.io) – יש תוכנית חינמית, תומך ב‑Capacitor, בונה וחותם iOS בלי Mac. צריך להעלות את ה‑repo ל‑GitHub.
  - חלופות: Bitrise, MacStadium (Mac מרוחק לפי שעה).

### 2. על ה‑Mac
```bash
git clone <repo>
npm install
npm run cap:sync
npx cap open ios
```
- ב‑Xcode: לבחור את הטארגט **App** → Signing & Capabilities → Team = החשבון שלך, Bundle Identifier = `co.shortforge.temple2048`.
- Product > Run על סימולטור/אייפון כדי לבדוק.

### 3. App Store Connect
1. https://appstoreconnect.apple.com → **My Apps > +** → New App: שם, Bundle ID (נרשם קודם ב‑Certificates, Identifiers & Profiles או ישירות מ‑Xcode), SKU חופשי.
2. אחרי יצירת האפליקציה, ב‑**App Information** מופיע **Apple ID** (מספר, למשל 6471234567).
   להכניס אותו ל‑`src/game/Config.ts`:

   ```ts
   export const APPLE_APP_ID = '6471234567';
   ```

   ואז `npm run cap:sync` ובנייה מחדש. בלי המספר הזה באנר הדירוג לא מוצג ב‑iOS (בכוונה, כדי לא לשלוח לקישור שבור).
3. למלא: צילומי מסך 6.7" (1290×2796) ו‑6.5" (1284×2778), תיאור, מילות מפתח, קטגוריה Games > Puzzle, גיל 4+, **App Privacy** – "Data Not Collected", קישור למדיניות פרטיות.

### 4. העלאה
- Xcode: **Product > Archive** → Distribute App → App Store Connect → Upload.
- (או Codemagic עושה את זה אוטומטית עם מפתח App Store Connect API.)
- ב‑App Store Connect: **TestFlight** – להתקין על האייפון שלך ולבדוק. אחר כך **Add for Review** בגרסה → **Submit**. ביקורת ראשונה לרוב 1‑3 ימים.

---

## אחרי הפרסום
- להעלות עדכון = להעלות מספר גרסה (`android/app/build.gradle` → `versionCode`/`versionName`, ב‑Xcode → Version/Build), `npm run cap:sync`, ולחזור על שלב ההעלאה.
- באנר "Rate us" מופיע אחרי 3 דקות משחק מצטברות, מקסימום 3 פעמים, ונעלם לתמיד אחרי "Rate us" או "No thanks". הערכים ב‑`src/game/Config.ts`.
