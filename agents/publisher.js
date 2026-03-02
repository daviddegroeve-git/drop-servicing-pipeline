const axios = require('axios');

/**
 * Publisher Agent
 * Modifies HTML to inject a checkout modal and publishes it to Vercel via their REST API.
 */
class PublisherAgent {
  constructor() {
    this.vercelToken = process.env.VERCEL_API_TOKEN;
    this.vercelProjectId = process.env.VERCEL_PROJECT_ID;

    if (!this.vercelToken || !this.vercelProjectId) {
      throw new Error('VERCEL_API_TOKEN or VERCEL_PROJECT_ID is not defined in environment variables.');
    }
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
          <p style="color: #4b5563; line-height: 1.5; margin-bottom: 2rem; font-size: 1rem;">
            Like what you see? You can unlock this site, connect your domain, and keep it live forever.
          </p>
          <a href="https://paytabs.com/placeholder-checkout" class="publisher-btn">
            Unlock & Keep for 99 SAR / Month
          </a>
        </div>
      </div>

      <script>
        setTimeout(() => {
          document.body.classList.add('modal-open');
          document.getElementById('publisher-modal-overlay').classList.add('show');
        }, 5000);
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
   * Deploys the HTML to Vercel
   * @param {string} businessName - The formatted name of the business
   * @param {string} compiledHtml - The final HTML string
   * @returns {Promise<string>} The generated Vercel URL
   */
  async deploySite(businessName, compiledHtml) {
    console.log(`[Publisher] Pushing ${businessName} to Vercel...`);

    // Generate an internal id/slug for the deployment name
    const sanitizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const deployName = `drop-service-${sanitizedName}-${Date.now()}`;

    try {
      const deployResponse = await axios.post(
        'https://api.vercel.com/v13/deployments',
        {
          name: deployName,
          projectId: this.vercelProjectId,
          files: [
            {
              file: 'index.html',
              data: compiledHtml
            }
          ],
          target: 'production'
        },
        {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`
          }
        }
      );

      // Deploy response gives back a URL e.g. "my-project-url.vercel.app"
      const url = `https://${deployResponse.data.url}`;
      console.log(`[Publisher] Deployed successfully to: ${url}`);

      return url;
    } catch (error) {
      console.error(`[Publisher] Vercel deploy error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
      throw error;
    }
  }

  /**
   * Executes the injection and deployment pipeline
   */
  async handlePublish(businessName, rawHtml) {
    const injectedHtml = this.injectModal(rawHtml);
    const liveUrl = await this.deploySite(businessName, injectedHtml);
    return liveUrl;
  }
}

module.exports = PublisherAgent;
