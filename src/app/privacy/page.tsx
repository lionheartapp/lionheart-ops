import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Privacy Policy | Lionheart',
  description:
    'Lionheart Privacy Policy — how we collect, use, and protect data for K-12 school operations. COPPA and FERPA compliant.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-gray prose-headings:font-semibold max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: March 2026</p>

          <p className="text-gray-700 leading-relaxed mb-8">
            Lionheart (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates a school
            operations management platform designed specifically for K-12 educational institutions.
            We understand that school communities place enormous trust in the tools they use to manage
            student and staff information, and we take that responsibility seriously. This Privacy
            Policy explains what information we collect, how we use it, who we share it with, and
            the rights you have regarding your data. Please read this policy carefully before using
            the Lionheart platform.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            1. What We Collect
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We collect several categories of information to provide and improve our services:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Organization data:</strong> When a school or district signs up, we collect the
            organization name, primary contact information, billing address, and chosen subdomain.
            This identifies the account and allows us to configure the multi-tenant environment
            unique to each organization.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>User data:</strong> Administrators create accounts for staff members on the
            platform. We collect and store names, email addresses, job roles, and encrypted
            passwords for each user account. Profile photos may be uploaded optionally. Users
            may also be associated with specific school campuses within an organization.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Operational data:</strong> The core function of Lionheart is to help schools
            manage tickets, events, schedules, facilities, and inventory. This includes data such
            as maintenance ticket descriptions, priority levels and status updates, room and
            building assignments, event details, teacher schedules, and inventory records. This
            information is entered by authorized school staff and remains the property of the
            school organization.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Technical data:</strong> We automatically collect certain technical information
            when you use our platform, including IP addresses, browser type and version, operating
            system, referring URLs, pages visited, time spent on the platform, and error logs.
            This information is used to maintain platform security, diagnose technical issues, and
            improve overall performance.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            2. How We Use Data
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Service delivery:</strong> The primary purpose for collecting data is to
            deliver the Lionheart platform&rsquo;s features to your organization. We use account
            and user data to authenticate users, manage permissions, and provide access to
            relevant features based on assigned roles. Operational data powers the ticket
            system, event calendar, facility management tools, and other core functionality.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Internal operations:</strong> We use technical and usage data to monitor
            platform health, identify and fix bugs, plan capacity improvements, and develop
            new features. Aggregated, de-identified usage patterns may inform product roadmap
            decisions. We do not use individual operational data to make product decisions.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Communications:</strong> We may use email addresses to send transactional
            communications such as account setup links, password reset emails, and important
            service announcements. We do not send unsolicited marketing emails to school
            staff without explicit consent.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Security and fraud prevention:</strong> We use collected data to detect and
            prevent unauthorized access, abuse of the platform, and other security threats.
            Authentication logs and access records help us investigate security incidents and
            enforce our Terms of Service.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            3. Data Sharing
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We do not sell, rent, or trade your personal information or your organization&rsquo;s
            data to any third parties. Period. We share data only in the limited circumstances
            described below:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Third-party service providers (sub-processors):</strong> We engage trusted
            infrastructure and service providers to help deliver the platform:
          </p>
          <ul className="list-disc list-inside text-gray-700 leading-relaxed mb-4 space-y-2">
            <li>
              <strong>Supabase / PostgreSQL:</strong> Our database infrastructure. All school and
              user data is stored in Supabase-managed PostgreSQL databases with encryption at rest.
              Supabase processes data solely on our behalf and is contractually prohibited from
              using your data for any other purpose.
            </li>
            <li>
              <strong>Resend:</strong> Our transactional email provider. Email addresses and
              message content are shared with Resend only to the extent necessary to deliver
              account-related emails. Resend does not use this information for its own marketing.
            </li>
            <li>
              <strong>Google Gemini (AI features):</strong> When AI-assisted features are enabled,
              relevant operational data may be sent to Google&rsquo;s Gemini API to generate
              summaries, suggestions, or analyses. Schools can opt out of AI features. Data
              processed by Gemini is subject to Google&rsquo;s API data processing terms.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Legal requirements:</strong> We may disclose information if required by law,
            court order, or government regulation. We will notify affected organizations before
            complying with such requirements to the extent permitted by law.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            4. FERPA Compliance
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Family Educational Rights and Privacy Act (FERPA) protects the privacy of student
            education records. Lionheart is designed to support schools&rsquo; FERPA compliance
            obligations as follows:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Lionheart as a &ldquo;school official&rdquo;:</strong> Under FERPA, schools may
            disclose education records to school officials who have a &ldquo;legitimate educational
            interest.&rdquo; When schools use Lionheart to manage operations that may touch on
            education records (such as facility assignments, schedules, or communications involving
            students), Lionheart acts as a school official with a legitimate educational interest
            as defined by the school&rsquo;s annual FERPA notification.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>School direction and control:</strong> Lionheart accesses education records
            only as directed by the school. We do not independently determine how student data
            is used; we process it solely under the instruction of authorized school personnel.
            Schools retain full control over what data is entered into the system and how it is
            organized.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Data ownership:</strong> Schools maintain FERPA-compliant ownership of all
            student data entered into the Lionheart platform. This data is treated as the school&rsquo;s
            education records. Lionheart holds no independent rights to use, disclose, or transfer
            this data beyond what is necessary to provide the contracted services.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Non-disclosure commitment:</strong> We will not disclose education records
            to third parties without written consent from the school, except as permitted or
            required by FERPA and this Privacy Policy. Schools seeking to verify our FERPA
            compliance practices may contact us at privacy@lionheartapp.com.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            5. COPPA Compliance
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Children&rsquo;s Online Privacy Protection Act (COPPA) governs the online collection
            of personal information from children under the age of 13. Lionheart is designed for
            use by school administrators, faculty, and staff — not directly by students or children.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Platform design:</strong> Lionheart is a school administration platform.
            Student accounts are not created on the platform for direct student use. All user
            accounts are created by organization administrators for school staff members who
            are adults or older minors acting in an administrative capacity. Children under 13
            do not directly interact with our platform.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Student data entered by school staff:</strong> To the extent that school staff
            enter any information about students (such as student names in ticket descriptions
            or room assignments), this data is entered by adult school staff members acting
            within the scope of their professional responsibilities. Under COPPA guidance, such
            data collection by schools for their internal operational purposes falls under the
            school&rsquo;s authority to act in loco parentis.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>School responsibility for parental consent:</strong> Schools are responsible
            for obtaining any necessary parental consent required under applicable law before
            entering student information into Lionheart. We strongly encourage schools to review
            their COPPA obligations and ensure that their use of Lionheart complies with their
            district&rsquo;s privacy policies and applicable regulations. Schools that have questions
            about their COPPA responsibilities should consult with their legal counsel.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            6. Data Retention
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We retain your organization&rsquo;s data for as long as your account is active. This
            means all operational data, user accounts, tickets, events, and other records are
            preserved throughout the active subscription period so that historical records remain
            accessible.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            When an organization cancels its subscription, we will retain data for a 30-day
            period following cancellation to allow for data export and transition. After this
            period, all organization data — including user accounts, tickets, events, and
            operational records — is permanently deleted from our systems. We do not maintain
            archived copies of deleted organization data. If you require a data export prior
            to cancellation, please contact us at privacy@lionheartapp.com.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            7. Security
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We implement industry-standard security measures to protect your data:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Encryption:</strong> All data is encrypted at rest using AES-256 encryption
            provided by our database infrastructure. All data in transit is encrypted using
            TLS 1.2 or higher. We do not transmit unencrypted sensitive data over public networks.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Authentication security:</strong> Session tokens are stored in httpOnly
            cookies, preventing access by client-side JavaScript and mitigating XSS attacks.
            Passwords are hashed using industry-standard cryptographic algorithms before storage.
            We never store plaintext passwords.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Role-based access controls:</strong> The platform enforces granular
            role-based access controls, ensuring that users can only access data appropriate
            to their assigned role. Organization administrators control user roles and can
            restrict access at a fine-grained level. All API endpoints require authentication,
            and unauthorized access attempts are logged and rate-limited.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            8. Your Rights
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            School organizations and their authorized administrators have the following rights
            regarding their data:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Access:</strong> You may request a complete export of your organization&rsquo;s
            data at any time. We will provide data exports in a machine-readable format within
            10 business days of a valid request.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Correction:</strong> You may update or correct any information stored in the
            platform through the administrative interface, or by contacting us directly if the
            data cannot be corrected through normal platform controls.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Deletion:</strong> You may request deletion of your organization&rsquo;s account
            and all associated data by contacting us. As described in the Data Retention section,
            complete deletion will occur within 30 days of account cancellation.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            <strong>Portability:</strong> We support data portability and will provide your
            organization&rsquo;s data in standard formats upon request to facilitate migration to
            other services.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            9. Contact
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have questions, concerns, or requests regarding this Privacy Policy or our
            data practices, please contact our privacy team at:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Email:</strong>{' '}
            <a
              href="mailto:privacy@lionheartapp.com"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              privacy@lionheartapp.com
            </a>
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            We are committed to resolving privacy-related concerns and will respond to
            inquiries within 5 business days. For concerns that cannot be resolved directly,
            you may also have the right to lodge a complaint with your relevant data protection
            authority.
          </p>
          <p className="text-gray-700 leading-relaxed">
            This Privacy Policy may be updated from time to time to reflect changes in our
            practices or applicable law. Material changes will be communicated to organization
            administrators via email at least 30 days before they take effect. Continued use
            of the platform after the effective date of any update constitutes acceptance of
            the revised policy.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
