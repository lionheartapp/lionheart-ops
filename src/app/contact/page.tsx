import type { Metadata } from 'next'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us | Lionheart',
  description:
    'Get in touch with the Lionheart team — sales, privacy, legal, billing, or general questions. We respond within one business day.',
}

export default function ContactPage() {
  return <ContactForm />
}
