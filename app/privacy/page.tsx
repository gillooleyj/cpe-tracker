import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Argus",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
        Last updated: February 28, 2026
      </p>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Who We Are</h2>
          <p>
            Argus ("we," "us," or "our") is a professional certification tracking application.
            For questions about this policy or to exercise your data rights, contact us at{" "}
            <a href="mailto:privacy@cooeytools.com" className="text-blue-700 dark:text-blue-400 hover:underline">
              privacy@cooeytools.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Data We Collect</h2>
          <p className="mb-3">We collect only the data necessary to provide the service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account data:</strong> Email address and hashed password, provided at signup.</li>
            <li><strong>Profile data:</strong> First name, last name, and optional professional details (job title, organization type, location, certification focus). All optional fields beyond name are voluntary.</li>
            <li><strong>Certification records:</strong> Names, issuers, dates, and CPD requirements for certifications you add.</li>
            <li><strong>CPD activity records:</strong> Training activities, hours, dates, providers, and optional descriptions you log.</li>
            <li><strong>File attachments:</strong> Certificate scans or proof-of-completion documents you optionally upload (stored privately; never shared).</li>
            <li><strong>Security data:</strong> Multi-factor authentication factors and bcrypt-hashed backup codes.</li>
            <li><strong>Notification preferences:</strong> Your choices about which in-app reminders to receive.</li>
          </ul>
          <p className="mt-3">We do <strong>not</strong> collect payment information, browsing behavior, device fingerprints, or location data beyond what you voluntarily provide in your profile.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide and operate the certification tracking service.</li>
            <li>To authenticate you securely, including multi-factor authentication.</li>
            <li>To display your CPD progress and renewal deadlines.</li>
            <li>To send in-app notifications you have opted into (future feature).</li>
          </ul>
          <p className="mt-3">We do not sell your data. We do not use your data for advertising or share it with third parties for marketing.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Legal Basis for Processing (GDPR)</h2>
          <p>If you are located in the European Economic Area, our legal basis for processing your data is:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li><strong>Contract performance</strong> — processing necessary to provide the service you have signed up for.</li>
            <li><strong>Legitimate interests</strong> — security logging and fraud prevention.</li>
            <li><strong>Consent</strong> — optional profile fields and notification preferences, which you may withdraw at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Data Storage and Security</h2>
          <p>
            Your data is stored by{" "}
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 hover:underline">
              Supabase
            </a>
            , our infrastructure provider (data processor). Data is encrypted at rest and in transit. Row-level security policies ensure your data is accessible only to your authenticated session.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Data Retention</h2>
          <p>
            Your data is retained for as long as your account is active. When you delete your account, all personal data — including your profile, certifications, CPD activities, and uploaded files — is permanently and immediately deleted. We do not retain backup copies of deleted account data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Your Rights</h2>
          <p className="mb-3">Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Access</strong> — download a copy of your data via Account → Download My Data.</li>
            <li><strong>Rectification</strong> — update your profile information at any time in Account settings.</li>
            <li><strong>Erasure</strong> — permanently delete your account and all associated data via Account → Delete Account.</li>
            <li><strong>Portability</strong> — export your data in JSON format via Account → Download My Data.</li>
            <li><strong>Withdraw consent</strong> — update or remove optional profile fields and notification preferences at any time.</li>
          </ul>
          <p className="mt-3">
            To exercise rights that are not self-service, contact{" "}
            <a href="mailto:privacy@cooeytools.com" className="text-blue-700 dark:text-blue-400 hover:underline">
              privacy@cooeytools.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Cookies</h2>
          <p>
            We use strictly necessary session cookies to keep you authenticated. We do not use analytics cookies, advertising cookies, or any third-party tracking. No cookie consent banner is required because we only use essential cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Changes to This Policy</h2>
          <p>
            If we make material changes to this policy, we will notify you via email or a notice on the application before the change takes effect. The "Last updated" date at the top of this page will always reflect the current version.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Contact</h2>
          <p>
            Questions or concerns about this policy?{" "}
            <a href="mailto:privacy@cooeytools.com" className="text-blue-700 dark:text-blue-400 hover:underline">
              privacy@cooeytools.com
            </a>
          </p>
        </section>

      </div>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link href="/terms" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
          Terms of Service →
        </Link>
      </div>
    </main>
  );
}
