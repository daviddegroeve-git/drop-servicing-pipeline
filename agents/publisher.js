/**
 * Publisher Agent
 * Generates dynamic URL for leads.
 * Injects checkout modals when rendering via the API.
 */
class PublisherAgent {
  constructor() {
    this.baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://drop-servicing-pipeline.vercel.app';
  }

  /**
   * Injects the payment modal snippet before </body>
   * @param {string} htmlString - Original website HTML
   * @param {string} placeId - The ID of the lead for tracking
   * @returns {string} Modified HTML
   */
  injectModal(htmlString, placeId) {
    // Generate a unique identifier for the script/styles so it doesn't clash
    const modalSnippet = `
      <style>
        #publisher-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9998;
          display: none;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        #publisher-modal-box {
          background: #ffffff;
          padding: 2.5rem;
          border-radius: 1rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          text-align: center;
          max-width: 90%;
          width: 450px;
          z-index: 9999;
          transform: translateY(20px);
          transition: transform 0.5s ease;
          position: relative;
        }
        #publisher-modal-overlay.show {
          display: flex;
          opacity: 1;
        }
        #publisher-modal-overlay.show #publisher-modal-box {
          transform: translateY(0);
        }
        .publisher-btn {
          display: inline-block;
          margin-top: 1.5rem;
          background: linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%);
          color: white;
          padding: 1rem 2rem;
          font-weight: bold;
          font-size: 1.125rem;
          border-radius: 0.5rem;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .publisher-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
        }
        body.modal-open {
          overflow: hidden;
        }
        /* Bilingual CSS for modal */
        html[lang="en"] .mod-lang-ar { display: none !important; }
        html[lang="ar"] .mod-lang-en { display: none !important; }
        html[lang="ar"] #publisher-modal-box { text-align: right; direction: rtl; }
        html[lang="en"] #publisher-modal-box { text-align: left; direction: ltr; }
        html[lang="ar"] .mod-ltr { direction: ltr; display: inline-block; }
        
        .mod-lang-toggle {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #f3f4f6;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          color: #374151;
          font-size: 0.875rem;
          transition: background 0.2s;
        }
        html[lang="ar"] .mod-lang-toggle { left: 1rem; right: auto; }
        .mod-lang-toggle:hover { background: #e5e7eb; }

        /* Pricing Toggle Switch */
        .billing-toggle {
          display: flex;
          background: #f3f4f6;
          border-radius: 999px;
          padding: 0.25rem;
          margin: 1.5rem auto;
          position: relative;
          width: fit-content;
        }
        .billing-toggle button {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.875rem;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          z-index: 2;
        }
        .billing-toggle button.active {
          color: #111827;
        }
        #toggle-bg {
          position: absolute;
          top: 0.25rem;
          bottom: 0.25rem;
          left: 0.25rem;
          width: calc(50% - 0.25rem);
          background: white;
          border-radius: 999px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }
        .billing-yearly-active #toggle-bg {
          transform: translateX(100%);
        }
        html[lang="ar"] .billing-yearly-active #toggle-bg {
          transform: translateX(-100%); /* RTL switch direction */
        }
        .badge-rec {
          position: absolute;
          top: -10px;
          right: -10px;
          background: #10b981;
          color: white;
          font-size: 0.6rem;
          padding: 2px 6px;
          border-radius: 999px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(16,185,129,0.3);
        }
        html[lang="ar"] .badge-rec {
          right: auto;
          left: -10px;
        }
      </style>
      
      <div id="publisher-modal-overlay">
        <div id="publisher-modal-box">
          <button class="mod-lang-toggle" onclick="toggleModalLang()">
             <span class="mod-lang-en">عربي</span>
             <span class="mod-lang-ar">English</span>
          </button>
          
          <!-- Dynamic Headers -->
          <h2 class="mod-lang-en" id="header-en" style="font-size: 1.5rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; margin-top: 1rem;">
            Save big with Yearly
          </h2>
          <h2 class="mod-lang-ar" id="header-ar" style="font-size: 1.5rem; font-weight: bold; color: #1f2937; margin-bottom: 0.5rem; margin-top: 1rem;">
            وفر الكثير مع السنوي
          </h2>
          
          <p class="mod-lang-en" id="desc-en" style="color: #4b5563; line-height: 1.5; font-size: 1rem; margin-bottom: 0;">
            Pay for 10 months, get 12 months of premium features.
          </p>
          <p class="mod-lang-ar" id="desc-ar" style="color: #4b5563; line-height: 1.5; font-size: 1rem; margin-bottom: 0;">
            ادفع لـ 10 أشهر، واحصل على 12 شهراً من الميزات الفاخرة.
          </p>

          <!-- Toggle -->
          <div class="billing-toggle billing-yearly-active" id="billing-switcher">
            <div id="toggle-bg"></div>
            <button id="btn-monthly" onclick="setBilling('monthly')">
               <span class="mod-lang-en">Monthly</span>
               <span class="mod-lang-ar">شهري</span>
            </button>
            <button id="btn-yearly" class="active" onclick="setBilling('yearly')">
               <span class="mod-lang-en">Yearly</span>
               <span class="mod-lang-ar">سنوي</span>
               <span class="badge-rec">
                 <span class="mod-lang-en">Save 17%</span>
                 <span class="mod-lang-ar">توفير ١٧٪</span>
               </span>
            </button>
          </div>

          <!-- Price Display -->
          <div class="price-display" style="margin-bottom: 1.5rem;">
            <div id="price-old" style="text-decoration: line-through; color: #9ca3af; font-size: 1rem; height: 1.5rem;">
              <span class="mod-ltr">1188 SAR</span>
            </div>
            <div style="display: flex; align-items: baseline; justify-content: center; gap: 4px;">
                <span id="price-current" style="font-size: 2.5rem; font-weight: 800; color: #111827;">990</span>
                <span style="font-size: 1rem; color: #6b7280; font-weight: 500;">
                  SAR / 
                  <span class="mod-lang-en" id="price-period-en">year</span>
                  <span class="mod-lang-ar" id="price-period-ar">سنة</span>
                </span>
            </div>
            <div id="savings-badge" style="color: #059669; background: #d1fae5; display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; margin-top: 4px;">
                <span class="mod-lang-en">Save 198 annually</span>
                <span class="mod-lang-ar">وفر 198 سنوياً</span>
            </div>
          </div>

          <div style="background: #f3f4f6; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem;">
            <p class="mod-lang-en" style="color: #374151; font-weight: 600; font-size: 0.875rem; margin: 0 0 0.5rem 0; text-transform: uppercase;">Payment Instructions:</p>
            <p class="mod-lang-ar" style="color: #374151; font-weight: 600; font-size: 0.875rem; margin: 0 0 0.5rem 0; text-transform: uppercase;">تعليمات الدفع:</p>
            
            <p class="mod-lang-en" style="color: #1f2937; margin: 0;">1. Open your <b>STC Pay</b> App.</p>
            <p class="mod-lang-ar" style="color: #1f2937; margin: 0;">1. افتح تطبيق <b>STC Pay</b> الخاص بك.</p>
            
            <p class="mod-lang-en" style="color: #1f2937; margin: 0.5rem 0;">2. Transfer exactly <b id="transfer-amt-en">990</b> SAR to:</p>
            <p class="mod-lang-ar" style="color: #1f2937; margin: 0.5rem 0;">2. قم بتحويل <b id="transfer-amt-ar">990</b> ريال سعودي بالضبط إلى:</p>
            
            <div dir="ltr" style="background: transparent; border: 2px dashed #3B82F6; color: #3B82F6; font-size: 1.25rem; font-weight: bold; letter-spacing: 1px; padding: 0.5rem; border-radius: 0.5rem; text-align: center; cursor: pointer; user-select: text;">
              +966 50 791 3514
            </div>
            
            <p class="mod-lang-en" style="color: #6b7280; font-size: 0.75rem; margin-top: 0.5rem; text-align: center;">Wait for the transfer to complete successfully.</p>
            <p class="mod-lang-ar" style="color: #6b7280; font-size: 0.75rem; margin-top: 0.5rem; text-align: center;">انتظر حتى تكتمل عملية التحويل بنجاح.</p>
          </div>

          <a id="whatsapp-btn" href="#" target="_blank" class="publisher-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding-left: 0; padding-right: 0; box-sizing: border-box;">
            <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="..." /></svg>
            <span class="mod-lang-en" id="cta-text-en">Get Yearly - 990 SAR</span>
            <span class="mod-lang-ar" id="cta-text-ar">اشترك سنوياً - 990 ريال</span>
          </a>
          
          <p style="color: #9ca3af; font-size: 0.75rem; margin-top: 1rem; text-align: center;">
            <svg style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="mod-lang-en">Your live preview will be available again in 1 hour.</span>
            <span class="mod-lang-ar">ستكون معاينتك المباشرة متاحة مرة أخرى بعد ساعة واحدة.</span>
          </p>
        </div>
      </div>

      <script>
        let currentPlan = 'yearly';

        function toggleModalLang() {
           const currentLang = document.documentElement.lang || 'en';
           document.documentElement.lang = currentLang === 'en' ? 'ar' : 'en';
        }

        function setBilling(plan) {
            currentPlan = plan;
            const switcher = document.getElementById('billing-switcher');
            const btnMonthly = document.getElementById('btn-monthly');
            const btnYearly = document.getElementById('btn-yearly');

            const priceOld = document.getElementById('price-old');
            const currentPrice = document.getElementById('price-current');
            const periodEn = document.getElementById('price-period-en');
            const periodAr = document.getElementById('price-period-ar');
            const savingsBadge = document.getElementById('savings-badge');
            
            const headerEn = document.getElementById('header-en');
            const headerAr = document.getElementById('header-ar');
            const descEn = document.getElementById('desc-en');
            const descAr = document.getElementById('desc-ar');

            const transferEn = document.getElementById('transfer-amt-en');
            const transferAr = document.getElementById('transfer-amt-ar');
            const ctaEn = document.getElementById('cta-text-en');
            const ctaAr = document.getElementById('cta-text-ar');
            const whatsappBtn = document.getElementById('whatsapp-btn');

            if (plan === 'yearly') {
                switcher.classList.add('billing-yearly-active');
                btnYearly.classList.add('active');
                btnMonthly.classList.remove('active');

                priceOld.style.visibility = 'visible';
                currentPrice.innerText = '990';
                periodEn.innerText = 'year';
                periodAr.innerText = 'سنة';
                savingsBadge.style.visibility = 'visible';

                headerEn.innerText = 'Save big with Yearly';
                headerAr.innerText = 'وفر الكثير مع السنوي';
                descEn.innerText = 'Pay for 10 months, get 12 months of premium features.';
                descAr.innerText = 'ادفع لـ 10 أشهر، واحصل على 12 شهراً من الميزات الفاخرة.';

                transferEn.innerText = '990';
                transferAr.innerText = '990';
                ctaEn.innerText = 'Get Yearly - 990 SAR';
                ctaAr.innerText = 'اشترك سنوياً - 990 ريال';
                whatsappBtn.href = "https://wa.me/966507913514?text=Hi!%20I%20just%20transferred%20990%20SAR%20via%20STC%20Pay%20for%20a%20YEARLY%20subscription%20to%20my%20generated%20website.%20Here%20is%20my%20receipt%20screenshot:";
            } else {
                switcher.classList.remove('billing-yearly-active');
                btnMonthly.classList.add('active');
                btnYearly.classList.remove('active');

                priceOld.style.visibility = 'hidden';
                currentPrice.innerText = '99';
                periodEn.innerText = 'month';
                periodAr.innerText = 'شهر';
                savingsBadge.style.visibility = 'hidden';

                headerEn.innerText = 'Your Live Preview is Ready!';
                headerAr.innerText = 'معاينتك المباشرة جاهزة!';
                descEn.innerText = 'Like what you see? You can keep it live forever for just 99 SAR / Month.';
                descAr.innerText = 'هل أعجبك ما تراه؟ يمكنك إبقاء الموقع يعمل للأبد مقابل 99 ريال سعودي / شهر.';

                transferEn.innerText = '99';
                transferAr.innerText = '99';
                ctaEn.innerText = 'Subscribe Monthly - 99 SAR';
                ctaAr.innerText = 'اشترك شهرياً - 99 ريال';
                whatsappBtn.href = "https://wa.me/966507913514?text=Hi!%20I%20just%20transferred%2099%20SAR%20via%20STC%20Pay%20for%20a%20MONTHLY%20subscription%20to%20my%20generated%20website.%20Here%20is%20my%20receipt%20screenshot:";
            }
        }

        (function() {
          const placeId = '${placeId}';
          
          setBilling('yearly'); // Initialize toggle state
          
          function trackMetric(action) {
             if (!placeId || placeId === 'undefined') return;
             fetch(\`/api/track?id=\${placeId}&action=\${action}\`).catch(e => console.error(e));
          }

          trackMetric('view');

          const ONE_HOUR = 60 * 60 * 1000;
          const ONE_MINUTE = 60 * 1000;
          const STORAGE_KEY = \`modal_last_shown_\${placeId}\`;
          
          let delay = ONE_MINUTE;
          
          const lastShownStr = localStorage.getItem(STORAGE_KEY);
          if (lastShownStr) {
             const lastShown = parseInt(lastShownStr, 10);
             const timeSinceLastShown = Date.now() - lastShown;
             if (timeSinceLastShown < ONE_HOUR) {
                delay = 0;
             }
          }

          setTimeout(() => {
            document.body.classList.add('modal-open');
            document.getElementById('publisher-modal-overlay').classList.add('show');
            localStorage.setItem(STORAGE_KEY, Date.now().toString());

            if (delay === ONE_MINUTE) {
                 trackMetric('full_minute');
            }
          }, delay);
        })();
      </script>
    `;

    // Try injecting before </body>, else just append at the bottom
    if (htmlString.indexOf('</body>') !== -1) {
      return htmlString.replace('</body>', `${modalSnippet}\n</body>`);
    } else {
      return `${htmlString}\n${modalSnippet}`;
    }
  }

  /**
   * Generates the dynamic URL for the site instead of deploying it
   * @param {string} placeId - The unique lead / place ID
   * @returns {string} The dynamic Vercel URL
   */
  async handlePublish(placeId) {
    if (!placeId) return null;

    // Construct the live URL pointing to the new dynamic site route
    const liveUrl = `${this.baseUrl}/site/${placeId}`;
    console.log(`[Publisher] Generated dynamic site link: ${liveUrl}`);
    return liveUrl;
  }
}

module.exports = PublisherAgent;
