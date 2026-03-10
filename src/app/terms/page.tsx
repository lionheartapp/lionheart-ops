import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

export const metadata: Metadata = {
  title: 'Terms of Service | Lionheart',
  description:
    'Terms of Service for the Lionheart school operations management platform. Governs use of our SaaS platform for K-12 educational institutions.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-gray prose-headings:font-semibold max-w-none">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: March 2026</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement
            between you (&ldquo;Customer,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and
            Lionheart (&ldquo;Lionheart,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) governing your access to and use of the Lionheart school operations
            management platform, including all associated software, services, and documentation
            (collectively, the &ldquo;Service&rdquo;).
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            By creating an account, accessing, or using the Service, you represent that you have
            read, understood, and agree to be bound by these Terms and our Privacy Policy, which
            is incorporated herein by reference. If you are accepting these Terms on behalf of a
            school, school district, or other educational organization, you represent and warrant
            that you have the authority to bind that organization to these Terms.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            If you do not agree to these Terms, you may not access or use the Service. Your
            continued use of the Service following any updates to these Terms constitutes your
            acceptance of the revised Terms.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            2. Description of Service
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Lionheart is a multi-tenant, cloud-based school operations management software-as-a-service
            (SaaS) platform designed for K-12 educational institutions. The Service provides tools
            for managing IT and maintenance tickets, facility and campus management, event planning,
            scheduling, inventory tracking, team collaboration, and related school operational
            workflows.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            The platform supports multi-campus organizations, enabling a single organization account
            to manage operations across multiple school locations with role-based access controls
            that restrict users to appropriate data and features. Each customer organization operates
            within an isolated tenant environment, and data from different organizations is never
            commingled.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Lionheart may offer optional add-on features, including AI-assisted analysis powered
            by third-party AI services. Add-on features may be subject to additional terms and
            fees. We reserve the right to introduce, modify, or discontinue features as the
            platform evolves, and will provide reasonable notice for material changes.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            3. Account Registration
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            To use the Service, an organization must register an account by providing accurate
            and complete information, including the organization name, a unique organization
            slug for subdomain access, and the primary administrator&rsquo;s contact information.
            The individual completing registration becomes the organization&rsquo;s initial
            super-administrator.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            The organization administrator is responsible for all activity that occurs under the
            organization&rsquo;s account, including the actions of all invited users. Administrators
            are responsible for maintaining the security of account credentials, promptly revoking
            access for users who leave the organization, and ensuring that all users comply with
            these Terms.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            You must provide accurate, current, and complete information during the registration
            process and keep your account information updated. Accounts created with false or
            misleading information may be suspended or terminated. Each organization may create
            only one account unless otherwise arranged with Lionheart.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            4. Acceptable Use
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You agree to use the Service only for lawful purposes and in accordance with these
            Terms. You agree not to use the Service in ways that:
          </p>
          <ul className="list-disc list-inside text-gray-700 leading-relaxed mb-4 space-y-2">
            <li>
              Violate any applicable federal, state, local, or international law or regulation,
              including but not limited to FERPA, COPPA, and other education privacy laws.
            </li>
            <li>
              Involve the transmission of any unsolicited or unauthorized advertising, promotional
              materials, or spam.
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other customers&rsquo; accounts,
              or any systems or networks connected to the Service.
            </li>
            <li>
              Introduce viruses, trojan horses, worms, logic bombs, or other technically harmful
              material into the Service or its underlying infrastructure.
            </li>
            <li>
              Engage in any conduct that restricts or inhibits anyone&rsquo;s use or enjoyment
              of the Service, or which may harm Lionheart or its users.
            </li>
            <li>
              Use the Service to store or transmit content that is unlawful, defamatory, harmful,
              abusive, harassing, or otherwise objectionable.
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or otherwise extract the source code of
              the Service.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-6">
            Lionheart reserves the right to investigate suspected violations and, where appropriate,
            suspend or terminate accounts engaged in prohibited use without prior notice.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            5. Data Ownership
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You retain all ownership rights to the data your organization submits to the Service
            (&ldquo;Customer Data&rdquo;). This includes all operational records, user accounts,
            tickets, events, facility data, and any other content you upload or create within the
            platform. Lionheart does not claim any intellectual property rights over your Customer Data.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            You grant Lionheart a limited, non-exclusive, worldwide license to host, store, transmit,
            display, and process your Customer Data solely as necessary to provide and improve the
            Service and as described in our Privacy Policy. This license terminates when you delete
            your data or close your account, subject to the data retention terms in our Privacy Policy.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Lionheart acts as a data processor with respect to any personal data contained in your
            Customer Data, and you act as the data controller. You are responsible for ensuring you
            have appropriate legal authority to submit data to the Service, including any data about
            students, parents, or other individuals. You represent that your collection and use of
            Customer Data complies with applicable privacy laws.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            6. Payment Terms
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service is offered on a subscription basis with fees billed on the schedule specified
            at the time of purchase (monthly or annual). All fees are stated in U.S. dollars and
            are exclusive of applicable taxes, which will be charged separately as required by law.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Free trial:</strong> Lionheart may offer a free trial period for new organizations.
            During the trial, you will have access to the Service&rsquo;s features at no charge for
            the duration specified. At the end of the trial, continued access requires selection of
            a paid subscription plan. We reserve the right to modify or terminate free trial offerings
            at any time.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            Subscription fees are charged in advance for each billing period. If you add users or
            upgrade your plan mid-period, additional charges will be prorated. All payments are
            non-refundable except as required by law or as otherwise specified in these Terms.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            If payment is not received by the due date, we may suspend your access to the Service
            with 10 days&rsquo; prior notice. Accounts suspended for non-payment may be terminated
            after 30 days of suspension, and Customer Data may be deleted in accordance with our
            data retention policy.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            7. Service Availability
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Lionheart will use commercially reasonable efforts to make the Service available with
            high reliability. We target 99.5% monthly uptime for the core platform functions,
            excluding scheduled maintenance and circumstances beyond our reasonable control.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            We perform routine maintenance and updates to keep the platform secure and performant.
            Whenever possible, maintenance windows will be scheduled during off-peak hours (typically
            weekends or late nights in the U.S. Eastern time zone) and will be announced to
            organization administrators at least 48 hours in advance for planned maintenance
            expected to exceed 30 minutes.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Lionheart is not liable for any interruptions caused by circumstances beyond our
            reasonable control, including natural disasters, internet service provider failures,
            third-party service outages, or government actions. We will work diligently to restore
            service in the event of any unplanned outage and will communicate status updates
            through our official channels.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            8. Limitation of Liability
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LIONHEART&rsquo;S TOTAL CUMULATIVE
            LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE
            SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO LIONHEART IN THE TWELVE (12) MONTHS
            IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            IN NO EVENT SHALL LIONHEART BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
            LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES,
            WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR ANY
            OTHER LEGAL THEORY, EVEN IF LIONHEART HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
            DAMAGES.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Some jurisdictions do not allow the exclusion or limitation of certain damages, so the
            above limitations may not apply to you. In such jurisdictions, our liability is limited
            to the fullest extent permitted by law.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            9. Termination
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Termination by you:</strong> You may cancel your subscription at any time
            through the account settings or by contacting us at legal@lionheartapp.com. Cancellation
            takes effect at the end of the current billing period. You will retain access to the
            Service until the end of the paid period.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Termination by Lionheart:</strong> We may suspend or terminate your account
            and access to the Service immediately upon notice if: (a) you materially breach these
            Terms and fail to cure the breach within 10 days of notice; (b) you engage in activity
            that we determine poses a security risk or harm to the Service or other customers;
            (c) you fail to pay fees when due; or (d) we are required to do so by applicable law.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Data export on request:</strong> Upon termination or cancellation, you may
            request an export of your Customer Data. Data export requests must be made within the
            30-day period following account cancellation. We will provide data in a standard
            machine-readable format within 10 business days. After the 30-day period, we have no
            obligation to retain or provide access to your data.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Provisions of these Terms that by their nature should survive termination will survive,
            including sections on Data Ownership, Limitation of Liability, and Governing Law.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            10. Governing Law
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms shall be governed by and construed in accordance with the laws of the state
            of incorporation of Lionheart, without regard to its conflict of law provisions. Any
            dispute arising out of or relating to these Terms or the Service that cannot be resolved
            by good-faith negotiation will be submitted to binding arbitration conducted by a
            recognized arbitration body in the state of incorporation, unless you are located in a
            jurisdiction where arbitration is not permitted.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Notwithstanding the foregoing, either party may seek injunctive or other equitable
            relief in any court of competent jurisdiction to prevent actual or threatened
            infringement of intellectual property rights or unauthorized use of the Service.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            11. Changes to Terms
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We may update these Terms from time to time as our Service evolves or as required by
            applicable law. For minor changes (such as clarifications or grammatical corrections
            that do not affect your rights), we will update the &ldquo;Last updated&rdquo; date
            at the top of this page.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            For material changes — those that meaningfully affect your rights or obligations —
            we will provide at least 30 days&rsquo; advance notice to organization administrators
            via email to the address on file. Material changes might include changes to payment
            terms, limitations on data usage, or significant changes to service availability.
            Your continued use of the Service after the effective date of material changes
            constitutes your acceptance of the revised Terms. If you do not agree to the revised
            Terms, you may terminate your account before the changes take effect.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">
            12. Contact
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have questions about these Terms of Service, wish to report a violation, or
            need to contact us regarding legal matters, please reach out to:
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Email:</strong>{' '}
            <a
              href="mailto:legal@lionheartapp.com"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              legal@lionheartapp.com
            </a>
          </p>
          <p className="text-gray-700 leading-relaxed">
            We are committed to resolving concerns in a fair and timely manner and will respond
            to legal inquiries within 5 business days.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
