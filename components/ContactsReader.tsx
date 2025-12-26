'use client'
import { useState } from 'react'
import { Phone, UserPlus, X, Check } from 'lucide-react'
import { User } from '@/types'

interface Contact {
  name: string
  phoneNumber: string
}

interface ContactsReaderProps {
  currentUser: User
  onSelectContact: (phoneNumber: string) => void
  onClose: () => void
}

export default function ContactsReader({ currentUser, onSelectContact, onClose }: ContactsReaderProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)

  const readContacts = async () => {
    setLoading(true)
    setError('')
    setContacts([])

    try {
      // Check if Contacts API is available
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const contactsManager = (navigator as any).contacts
        
        // Request permission and read contacts
        const props = ['name', 'tel']
        const opts = { multiple: true }
        
        try {
          const contactsList = await contactsManager.select(props, opts)
          
          if (contactsList && contactsList.length > 0) {
            const formattedContacts: Contact[] = contactsList
              .map((contact: any) => {
                const name = contact.name?.[0] || 'Unknown'
                const phoneNumbers = contact.tel || []
                
                // Return multiple contacts if a person has multiple phone numbers
                return phoneNumbers.map((phone: string) => ({
                  name,
                  phoneNumber: phone.replace(/\s/g, '')
                }))
              })
              .flat()
              .filter((contact: Contact) => contact.phoneNumber)
            
            setContacts(formattedContacts)
          } else {
            setError('No contacts found or permission denied')
          }
        } catch (err: any) {
          console.error('Error reading contacts:', err)
          setError('Failed to read contacts. Please check permissions.')
        }
      } else {
        // Fallback: Manual input
        setError('Contacts API not available. Please enter phone number manually.')
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError('Failed to access contacts: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPhone = (phoneNumber: string) => {
    setSelectedPhone(phoneNumber)
    onSelectContact(phoneNumber)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <Phone className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold">Read from Contacts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {contacts.length === 0 && !loading && (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                Click the button below to read contacts from your device
              </p>
              <button
                onClick={readContacts}
                className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-semibold"
              >
                Read Contacts
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Reading contacts...</p>
            </div>
          )}

          {contacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400 mb-3">
                Select a phone number from your contacts:
              </p>
              {contacts.map((contact, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectPhone(contact.phoneNumber)}
                  className={`w-full p-3 rounded bg-slate-700 hover:bg-slate-600 transition text-left flex items-center justify-between ${
                    selectedPhone === contact.phoneNumber ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-gray-400">{contact.phoneNumber}</p>
                  </div>
                  {selectedPhone === contact.phoneNumber && (
                    <Check className="h-5 w-5 text-blue-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

