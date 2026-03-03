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
   * @returns {string} Modified HTML
   */
  injectModal(htmlString) {
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
        /* Lock generic scrolling */
        body.modal-open {
          overflow: hidden;
        }
      </style>
      
      <div id="publisher-modal-overlay">
        <div id="publisher-modal-box">
          <h2 style="font-size: 1.5rem; font-weight: bold; color: #1f2937; margin-bottom: 1rem;">
            Your Live Preview is Ready!
          </h2>
          <p style="color: #4b5563; line-height: 1.5; margin-bottom: 1.5rem; font-size: 1rem;">
            Like what you see? You can unlock this site, connect your domain, and keep it live forever for just <b>99 SAR / Month</b>.
          </p>
          <div style="background: #f3f4f6; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1.5rem; text-align: left;">
            <p style="color: #374151; font-weight: 600; font-size: 0.875rem; margin: 0 0 0.5rem 0; text-transform: uppercase;">Payment Instructions:</p>
            <p style="color: #1f2937; margin: 0;">1. Open your <b>STC Pay</b> App.</p>
            <p style="color: #1f2937; margin: 0.5rem 0;">2. Transfer exactly 99 SAR to:</p>
            <div style="background: transparent; border: 2px dashed #3B82F6; color: #3B82F6; font-size: 1.25rem; font-weight: bold; letter-spacing: 1px; padding: 0.5rem; border-radius: 0.5rem; text-align: center; cursor: pointer; user-select: text;">
              +966 50 791 3514
            </div>
            <p style="color: #6b7280; font-size: 0.75rem; margin-top: 0.5rem; text-align: center;">Wait for the transfer to complete successfully.</p>
          </div>
          <a href="https://wa.me/966507913514?text=Hi!%20I%20just%20transferred%2099%20SAR%20via%20STC%20Pay%20for%20my%20generated%20website.%20Here%20is%20my%20receipt%20screenshot:" target="_blank" class="publisher-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding-left: 0; padding-right: 0; box-sizing: border-box;">
            <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12.0001 2.00098C6.47721 2.00098 2.00018 6.47781 2.00018 11.9996C2.00018 13.9877 2.58572 15.8458 3.5855 17.4101L2.25146 22.2854L7.26521 20.9701C8.75239 21.8492 10.334 22 12.0001 22C17.5255 22 22.0001 17.524 22.0001 12.0012C22.0001 9.32986 20.9602 6.81432 19.071 4.925C17.1819 3.03551 14.6666 1.99849 12.0001 2.00098ZM17.5301 16.3245C17.299 16.9733 16.3888 17.5539 15.6599 17.7028C15.1583 17.8058 14.4552 17.886 11.6663 16.7303C8.09337 15.2476 5.80718 11.619 5.64169 11.4018C5.47643 11.1843 4.43798 9.80214 4.43798 8.3705C4.43798 6.93874 5.166 6.24436 5.48003 5.92985C5.72828 5.68112 6.14167 5.54922 6.53855 5.54922C6.67104 5.54922 6.78652 5.55447 6.88562 5.55928C7.1668 5.5709 7.30733 5.58739 7.48914 6.02322C7.72061 6.585 8.28281 7.95758 8.34898 8.09458C8.41505 8.23126 8.51421 8.41724 8.41505 8.6186C8.31579 8.81974 8.2332 8.90221 8.08437 9.0682L7.66236 9.53935C7.51352 9.70428 7.34803 9.88569 7.51352 10.1706C7.67878 10.4552 8.25102 11.3886 9.09887 12.1437C10.1947 13.1197 11.0833 13.4312 11.3976 13.5683C11.7118 13.705 12.059 13.6888 12.2741 13.4566L12.8697 12.7214C13.1508 12.3734 13.5145 12.3392 13.8453 12.4578C14.1758 12.5768 15.9287 13.4411 16.2758 13.6152C16.6231 13.7885 16.8546 13.8753 16.9372 14.008C17.0198 14.1404 17.0198 14.7761 16.7885 15.4248V15.4245L17.5301 16.3245Z" /></svg>
            I have transferred 99 SAR
          </a>
        </div>
      </div>

      <script>
        setTimeout(() => {
          document.body.classList.add('modal-open');
          document.getElementById('publisher-modal-overlay').classList.add('show');
        }, 60000);
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
