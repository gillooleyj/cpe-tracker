import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — CredVault",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
        Last updated: February 28, 2026
      </p>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Acceptance</h2>
          <p>
            By creating an account or using CredVault, you agree to these Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Description of Service</h2>
          <p>
            CredVault is a tool for tracking professional certifications, continuing professional development (CPD) activities, and renewal deadlines. It is provided for personal and professional use.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Your Account</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You must provide accurate information and keep it up to date.</li>
            <li>You may not share your account with others or use the service on behalf of another person without their consent.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Acceptable Use</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Use the service for any unlawful purpose.</li>
            <li>Upload content you do not have the right to share.</li>
            <li>Attempt to access another user's data or circumvent security measures.</li>
            <li>Interfere with or disrupt the service or its infrastructure.</li>
            <li>Use the service to store sensitive personal data of third parties without their consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Your Data</h2>
          <p>
            You retain ownership of all data you enter into CredVault. By uploading content, you grant us a limited license to store and display that content solely for the purpose of providing the service to you. We do not claim ownership of your data and will not use it for any other purpose. See our{" "}
            <Link href="/privacy" className="text-blue-700 dark:text-blue-400 hover:underline">
              Privacy Policy
            </Link>{" "}
            for full details on how your data is handled.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">6. No Warranty on CPD Compliance</h2>
          <p>
            CredVault is a tracking tool only. We do not verify, certify, or guarantee that activities logged in the app meet the CPD requirements of any certification body. You are solely responsible for confirming compliance with your certification authority.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Service Availability</h2>
          <p>
            We provide the service on an "as is" and "as available" basis. We do not guarantee uninterrupted availability and are not liable for downtime, data loss, or errors. We recommend exporting your data periodically via Account → Download My Data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, we are not liable for indirect, incidental, consequential, or punitive damages arising from your use of the service, including any loss of data or certification standing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Termination</h2>
          <p>
            You may delete your account at any time via Account → Delete Account. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your data is permanently deleted as described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. Material changes will be communicated via email or in-app notice. Continued use of the service after the effective date constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">11. Contact</h2>
          <p>
            Questions about these terms?{" "}
            <a href="mailto:legal@credvault.app" className="text-blue-700 dark:text-blue-400 hover:underline">
              legal@cooeytools.com
            </a>
          </p>
        </section>

      </div>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link href="/privacy" className="text-sm text-blue-700 dark:text-blue-400 hover:underline">
          ← Privacy Policy
        </Link>
      </div>
    </main>
  );
}
