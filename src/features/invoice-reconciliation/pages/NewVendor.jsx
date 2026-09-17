import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendors } from '../context/VendorContext';

const SECTIONS = ['Other Details', 'Address', 'Contact Persons', 'Bank Details', 'Custom Fields', 'Reporting Tags', 'Remarks'];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const TDS_OPTIONS = ['None', '194C - Contractors', '194J - Professional/Technical Services', '194I - Rent', '194H - Commission'];
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.'];

const emptyAddress = { attention: '', addressLine1: '', addressLine2: '', city: '', state: '', pinCode: '', country: 'India', phone: '', fax: '' };
const emptyContact = { salutation: 'Mr.', firstName: '', lastName: '', email: '', workPhone: '', mobile: '' };
const emptyBank = { beneficiaryName: '', bankName: '', accountNumber: '', ifsc: '', branch: '' };
const emptyCustomField = { label: '', value: '' };

export default function NewVendor() {
  const navigate = useNavigate();
  const { addVendor } = useVendors();
  const [activeSection, setActiveSection] = useState('Other Details');
  const [tagInput, setTagInput] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const [form, setForm] = useState({
    companyName: '', displayName: '', email: '', phone: '', language: 'English',
    pan: '', msmeRegistered: false, currency: 'INR', openingBalance: '',
    paymentTerms: 'Due on Receipt', tds: 'None', portalEnabled: false,
    billingAddress: { ...emptyAddress },
    shippingAddress: { ...emptyAddress },
    contactPersons: [{ ...emptyContact }],
    bankDetails: { ...emptyBank },
    customFields: [],
    reportingTags: [],
    remarks: ''
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setAddr = (which, key, value) => setForm(prev => ({ ...prev, [which]: { ...prev[which], [key]: value } }));
  const setBank = (key, value) => setForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [key]: value } }));

  const updateContact = (idx, key, value) => setForm(prev => ({
    ...prev,
    contactPersons: prev.contactPersons.map((c, i) => i === idx ? { ...c, [key]: value } : c)
  }));
  const addContact = () => setForm(prev => ({ ...prev, contactPersons: [...prev.contactPersons, { ...emptyContact }] }));
  const removeContact = (idx) => setForm(prev => ({ ...prev, contactPersons: prev.contactPersons.filter((_, i) => i !== idx) }));

  const updateCustomField = (idx, key, value) => setForm(prev => ({
    ...prev,
    customFields: prev.customFields.map((f, i) => i === idx ? { ...f, [key]: value } : f)
  }));
  const addCustomField = () => setForm(prev => ({ ...prev, customFields: [...prev.customFields, { ...emptyCustomField }] }));
  const removeCustomField = (idx) => setForm(prev => ({ ...prev, customFields: prev.customFields.filter((_, i) => i !== idx) }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.reportingTags.includes(t)) {
      set('reportingTags', [...form.reportingTags, t]);
    }
    setTagInput('');
  };
  const removeTag = (t) => set('reportingTags', form.reportingTags.filter(x => x !== t));

  const canSave = form.companyName.trim().length > 0;

  const handleSave = (andNew) => {
    if (!canSave) return;
    const payload = {
      ...form,
      shippingAddress: sameAsBilling ? { ...form.billingAddress } : form.shippingAddress
    };
    const created = addVendor(payload);
    if (andNew) {
      setForm({
        companyName: '', displayName: '', email: '', phone: '', language: 'English',
        pan: '', msmeRegistered: false, currency: 'INR', openingBalance: '',
        paymentTerms: 'Due on Receipt', tds: 'None', portalEnabled: false,
        billingAddress: { ...emptyAddress }, shippingAddress: { ...emptyAddress },
        contactPersons: [{ ...emptyContact }], bankDetails: { ...emptyBank },
        customFields: [], reportingTags: [], remarks: ''
      });
      setActiveSection('Other Details');
    } else {
      navigate(`/invoice-reconciliation/vendors/${created.vendorId}`);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 2rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)', margin: 0 }}>New Vendor</h1>
          <div style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginTop: '2px' }}>
            Demo record — no vendors backend exists yet, this saves to the session only.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="ir-action-btn ir-action-escalate" onClick={() => navigate('/invoice-reconciliation/vendors')}>Cancel</button>
          <button className="ir-action-btn ir-action-escalate" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={() => handleSave(true)}>Save and New</button>
          <button className="ir-action-btn ir-action-approve" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={() => handleSave(false)}>Save Vendor</button>
        </div>
      </div>

      {/* Primary Contact */}
      <div className="ir-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="ir-section-title">Primary Contact</div>
        <div className="ir-form-2col" style={{ marginTop: '1rem' }}>
          <div className="ir-form-group">
            <label className="ir-form-label">Company Name *</label>
            <input
              className="ir-form-in"
              value={form.companyName}
              onChange={e => {
                const v = e.target.value;
                // Mirror Zoho: display name follows the company name until edited by hand
                setForm(prev => {
                  const displayFollowsCompany = prev.displayName === prev.companyName || prev.displayName === '';
                  return { ...prev, companyName: v, displayName: displayFollowsCompany ? v : prev.displayName };
                });
              }}
              placeholder="e.g. Sundar Fabricators Pvt Ltd"
            />
          </div>
          <div className="ir-form-group">
            <label className="ir-form-label">Display Name *</label>
            <input className="ir-form-in" value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Name shown across the app" />
          </div>
          <div className="ir-form-group">
            <label className="ir-form-label">Email Address</label>
            <input className="ir-form-in" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="accounts@vendor.example" />
          </div>
          <div className="ir-form-group">
            <label className="ir-form-label">Phone</label>
            <input className="ir-form-in" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98xxx xxxxx" />
          </div>
          <div className="ir-form-group">
            <label className="ir-form-label">Vendor Language</label>
            <select className="ir-form-in" value={form.language} onChange={e => set('language', e.target.value)}>
              <option>English</option>
              <option>Hindi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sectioned details, Zoho-style left tab rail */}
      <div className="ir-card" style={{ padding: 0, display: 'flex', minHeight: '420px' }}>
        <div className="ir-vtabs">
          {SECTIONS.map(s => (
            <button
              key={s}
              className={`ir-vtab-btn${activeSection === s ? ' active' : ''}`}
              onClick={() => setActiveSection(s)}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: '1.75rem' }}>

          {activeSection === 'Other Details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}>
              <div className="ir-form-2col">
                <div className="ir-form-group">
                  <label className="ir-form-label">PAN</label>
                  <input className="ir-form-in" value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
                </div>
                <div className="ir-form-group">
                  <label className="ir-form-label">GSTIN</label>
                  <input className="ir-form-in" value={form.gstin || ''} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
                </div>
              </div>

              <label className="ir-check-row">
                <input type="checkbox" checked={form.msmeRegistered} onChange={e => set('msmeRegistered', e.target.checked)} />
                <span>This vendor is MSME registered</span>
              </label>

              <div className="ir-form-2col">
                <div className="ir-form-group">
                  <label className="ir-form-label">Currency</label>
                  <select className="ir-form-in" value={form.currency} onChange={e => set('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="ir-form-group">
                  <label className="ir-form-label">Opening Balance</label>
                  <input className="ir-form-in" type="number" value={form.openingBalance} onChange={e => set('openingBalance', e.target.value)} placeholder="0.00" />
                </div>
                <div className="ir-form-group">
                  <label className="ir-form-label">Payment Terms</label>
                  <select className="ir-form-in" value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>
                    {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ir-form-group">
                  <label className="ir-form-label">TDS</label>
                  <select className="ir-form-in" value={form.tds} onChange={e => set('tds', e.target.value)}>
                    {TDS_OPTIONS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <label className="ir-check-row">
                <input type="checkbox" checked={form.portalEnabled} onChange={e => set('portalEnabled', e.target.checked)} />
                <span>Allow portal access for this vendor</span>
              </label>
            </div>
          )}

          {activeSection === 'Address' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div className="ir-section-title" style={{ marginBottom: '0.75rem' }}>Billing Address</div>
                <AddressFields value={form.billingAddress} onChange={(k, v) => setAddr('billingAddress', k, v)} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div className="ir-section-title">Shipping Address</div>
                  <label className="ir-check-row" style={{ fontWeight: 600 }}>
                    <input type="checkbox" checked={sameAsBilling} onChange={e => setSameAsBilling(e.target.checked)} />
                    <span>Same as billing address</span>
                  </label>
                </div>
                {!sameAsBilling && <AddressFields value={form.shippingAddress} onChange={(k, v) => setAddr('shippingAddress', k, v)} />}
              </div>
            </div>
          )}

          {activeSection === 'Contact Persons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {form.contactPersons.map((c, idx) => (
                <div key={idx} className="ir-repeat-row">
                  <div className="ir-form-2col" style={{ flex: 1 }}>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Salutation</label>
                      <select className="ir-form-in" value={c.salutation} onChange={e => updateContact(idx, 'salutation', e.target.value)}>
                        {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div />
                    <div className="ir-form-group">
                      <label className="ir-form-label">First Name</label>
                      <input className="ir-form-in" value={c.firstName} onChange={e => updateContact(idx, 'firstName', e.target.value)} />
                    </div>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Last Name</label>
                      <input className="ir-form-in" value={c.lastName} onChange={e => updateContact(idx, 'lastName', e.target.value)} />
                    </div>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Email Address</label>
                      <input className="ir-form-in" type="email" value={c.email} onChange={e => updateContact(idx, 'email', e.target.value)} />
                    </div>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Work Phone</label>
                      <input className="ir-form-in" value={c.workPhone} onChange={e => updateContact(idx, 'workPhone', e.target.value)} />
                    </div>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Mobile</label>
                      <input className="ir-form-in" value={c.mobile} onChange={e => updateContact(idx, 'mobile', e.target.value)} />
                    </div>
                  </div>
                  {form.contactPersons.length > 1 && (
                    <button type="button" className="ir-remove-row-btn" onClick={() => removeContact(idx)} aria-label="Remove contact">×</button>
                  )}
                </div>
              ))}
              <button type="button" className="ir-add-row-btn" onClick={addContact}>+ Add Contact Person</button>
            </div>
          )}

          {activeSection === 'Bank Details' && (
            <div className="ir-form-2col" style={{ maxWidth: '640px' }}>
              <div className="ir-form-group">
                <label className="ir-form-label">Beneficiary Name</label>
                <input className="ir-form-in" value={form.bankDetails.beneficiaryName} onChange={e => setBank('beneficiaryName', e.target.value)} />
              </div>
              <div className="ir-form-group">
                <label className="ir-form-label">Bank Name</label>
                <input className="ir-form-in" value={form.bankDetails.bankName} onChange={e => setBank('bankName', e.target.value)} />
              </div>
              <div className="ir-form-group">
                <label className="ir-form-label">Account Number</label>
                <input className="ir-form-in" value={form.bankDetails.accountNumber} onChange={e => setBank('accountNumber', e.target.value)} />
              </div>
              <div className="ir-form-group">
                <label className="ir-form-label">IFSC</label>
                <input className="ir-form-in" value={form.bankDetails.ifsc} onChange={e => setBank('ifsc', e.target.value.toUpperCase())} />
              </div>
              <div className="ir-form-group">
                <label className="ir-form-label">Branch</label>
                <input className="ir-form-in" value={form.bankDetails.branch} onChange={e => setBank('branch', e.target.value)} />
              </div>
            </div>
          )}

          {activeSection === 'Custom Fields' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {form.customFields.length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>No custom fields yet.</div>
              )}
              {form.customFields.map((f, idx) => (
                <div key={idx} className="ir-repeat-row">
                  <div className="ir-form-2col" style={{ flex: 1 }}>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Label</label>
                      <input className="ir-form-in" value={f.label} onChange={e => updateCustomField(idx, 'label', e.target.value)} placeholder="e.g. Vendor Code" />
                    </div>
                    <div className="ir-form-group">
                      <label className="ir-form-label">Value</label>
                      <input className="ir-form-in" value={f.value} onChange={e => updateCustomField(idx, 'value', e.target.value)} />
                    </div>
                  </div>
                  <button type="button" className="ir-remove-row-btn" onClick={() => removeCustomField(idx)} aria-label="Remove field">×</button>
                </div>
              ))}
              <button type="button" className="ir-add-row-btn" onClick={addCustomField} style={{ alignSelf: 'flex-start' }}>+ Add Custom Field</button>
            </div>
          )}

          {activeSection === 'Reporting Tags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '480px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="ir-form-in"
                  style={{ flex: 1 }}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="e.g. Strategic, High Risk, MSME"
                />
                <button type="button" className="ir-action-btn ir-action-escalate" onClick={addTag}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {form.reportingTags.map(t => (
                  <span key={t} className="ir-tag-chip">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'Remarks' && (
            <div className="ir-form-group" style={{ maxWidth: '640px' }}>
              <label className="ir-form-label">Remarks</label>
              <textarea className="ir-form-ta" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Internal notes about this vendor..." />
            </div>
          )}

        </div>
      </div>

      {/* Documents */}
      <div className="ir-card" style={{ padding: '1.5rem', marginTop: '1.25rem' }}>
        <div className="ir-section-title">Documents</div>
        <div className="ir-dropzone-box" style={{ marginTop: '1rem', maxWidth: '360px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-600)' }}>Click to upload or drag files here</span>
          <span style={{ fontSize: '11.5px', color: 'var(--gray-400)' }}>You can upload a maximum of 10 files, 10MB each</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
        <button className="ir-action-btn ir-action-approve" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={() => handleSave(false)}>Save Vendor</button>
        <button className="ir-action-btn ir-action-escalate" onClick={() => navigate('/invoice-reconciliation/vendors')}>Cancel</button>
      </div>
    </div>
  );
}

function AddressFields({ value, onChange }) {
  return (
    <div className="ir-form-2col">
      <div className="ir-form-group">
        <label className="ir-form-label">Attention</label>
        <input className="ir-form-in" value={value.attention} onChange={e => onChange('attention', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">Country / Region</label>
        <input className="ir-form-in" value={value.country} onChange={e => onChange('country', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">Address Line 1</label>
        <input className="ir-form-in" value={value.addressLine1} onChange={e => onChange('addressLine1', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">Address Line 2</label>
        <input className="ir-form-in" value={value.addressLine2} onChange={e => onChange('addressLine2', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">City</label>
        <input className="ir-form-in" value={value.city} onChange={e => onChange('city', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">State</label>
        <input className="ir-form-in" value={value.state} onChange={e => onChange('state', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">Pin Code</label>
        <input className="ir-form-in" value={value.pinCode} onChange={e => onChange('pinCode', e.target.value)} />
      </div>
      <div className="ir-form-group">
        <label className="ir-form-label">Phone</label>
        <input className="ir-form-in" value={value.phone} onChange={e => onChange('phone', e.target.value)} />
      </div>
    </div>
  );
}
