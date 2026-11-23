import { useState } from 'react';
import { CheckCircle2, Search, Send, Upload } from 'lucide-react';
import { SeverityBadge } from '../../components/SeverityBadge';
import type {
  Case,
  CaseEvent,
  CaseType,
  Role,
  SegmentName,
  Severity,
} from '../../domain/types';
import { INITIAL_SEGMENTS } from '../../sim/scenarios';
import { caseRepo, evidenceRepo } from '../../storage/repositories';

interface PortalWorkspaceProps {
  seed: number;
  role: Role;
  onCreated: () => Promise<void>;
}

export function PortalWorkspace({ seed, role, onCreated }: PortalWorkspaceProps) {
  const [caseType, setCaseType] = useState<CaseType>('INC');
  const [segment, setSegment] = useState<SegmentName>('Web Portal');
  const [priority, setPriority] = useState<Severity>('medium');
  const [impact, setImpact] = useState<Case['impact']>('team');
  const [reporterName, setReporterName] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<{ ref: string; code: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Follow-up lookup
  const [lookupRef, setLookupRef] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    caseRecord: Case;
    events: CaseEvent[];
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !summary.trim() || !reporterName.trim()) {
      setFormError('Reporter name, title, and description are required.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await caseRepo.create({
        type: caseType,
        priority,
        impact,
        segment,
        scenarioKey: segment === 'Web Portal' ? 'bf' : segment === 'WAN' ? 'slow' : segment === 'VPN' ? 'lat' : null,
        reporterName,
        title,
        summary,
        seed,
        actorRole: role,
      });

      if (attachment) {
        await evidenceRepo.addBlob({
          caseId: created.id,
          kind: attachment.type.startsWith('image/') ? 'screenshot' : 'log',
          filename: attachment.name,
          blob: attachment,
          capturedBy: reporterName,
          role: 'end_user',
        });
      }

      setSubmittedReceipt({ ref: created.ref, code: created.trackingCode });
      setTitle('');
      setSummary('');
      setAttachment(null);
      await onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit case.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    const found = await caseRepo.getByRefAndCode(lookupRef, lookupCode);
    if (!found) {
      setLookupError('No ticket matched that reference and 6-digit tracking code.');
      return;
    }
    const events = await caseRepo.getEvents(found.id);
    setLookupResult({ caseRecord: found, events });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Intake Form */}
      <form onSubmit={handleSubmit} className="lg:col-span-7 theme-surface p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold font-display">End User Service Desk Intake</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            Report a security incident (INC) or request access/changes (SR). Receives a sequential reference and 6-digit tracking code.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['INC', 'INC · Report Incident'],
              ['SR', 'SR · Service Request'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setCaseType(t)}
              className="py-2.5 px-3 text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: caseType === t ? 'var(--t-accent)' : 'var(--t-surface-alt)',
                color: caseType === t ? 'var(--t-accent-contrast)' : 'var(--t-text)',
                border: '1px solid var(--t-border)',
                borderRadius: 'var(--t-radius-sm)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="portal-seg" className="block text-xs font-medium mb-1">
              System / Segment
            </label>
            <select
              id="portal-seg"
              value={segment}
              onChange={(e) => setSegment(e.target.value as SegmentName)}
              className="w-full px-3 py-2 text-xs theme-input"
            >
              {INITIAL_SEGMENTS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="portal-prio" className="block text-xs font-medium mb-1">
              Urgency
            </label>
            <select
              id="portal-prio"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Severity)}
              className="w-full px-3 py-2 text-xs theme-input"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="portal-imp" className="block text-xs font-medium mb-1">
              Impact Scope
            </label>
            <select
              id="portal-imp"
              value={impact}
              onChange={(e) => setImpact(e.target.value as Case['impact'])}
              className="w-full px-3 py-2 text-xs theme-input"
            >
              <option value="self">Only me</option>
              <option value="team">My team</option>
              <option value="department">Department</option>
              <option value="everyone">Organization-wide</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="portal-rep" className="block text-xs font-medium mb-1">
              Your Name
            </label>
            <input
              id="portal-rep"
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="e.g. T. Moyo"
              className="w-full px-3 py-2 text-xs theme-input"
            />
          </div>
          <div>
            <label htmlFor="portal-title" className="block text-xs font-medium mb-1">
              Short Summary
            </label>
            <input
              id="portal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={caseType === 'INC' ? 'e.g. Repeated login lockouts' : 'e.g. Request VPN group access'}
              className="w-full px-3 py-2 text-xs theme-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="portal-desc" className="block text-xs font-medium mb-1">
            Detailed Description &amp; Observed Symptoms
          </label>
          <textarea
            id="portal-desc"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe what occurred, approximate UTC time, and error messages observed…"
            className="w-full p-3 text-xs theme-input"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium theme-btn-secondary cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{attachment ? attachment.name : 'Attach Screenshot / Log (Optional)'}</span>
            <input
              type="file"
              accept="image/*,.txt,.log"
              className="hidden"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold theme-btn-primary cursor-pointer min-h-[42px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting…' : `Submit ${caseType}`}</span>
          </button>
        </div>

        {formError && (
          <p className="text-xs" style={{ color: 'var(--t-crit)' }}>
            {formError}
          </p>
        )}

        {submittedReceipt && (
          <div className="p-4 theme-surface-alt space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--t-low)' }}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Ticket Logged Successfully</span>
            </div>
            <p className="text-xs font-mono-tabular">
              Reference: <strong>{submittedReceipt.ref}</strong> · Tracking PIN:{' '}
              <strong>{submittedReceipt.code}</strong>
            </p>
            <button
              type="button"
              onClick={() => {
                setLookupRef(submittedReceipt.ref);
                setLookupCode(submittedReceipt.code);
              }}
              className="text-xs underline cursor-pointer"
              style={{ color: 'var(--t-accent)' }}
            >
              Fill into Follow-Up Lookup →
            </button>
          </div>
        )}
      </form>

      {/* Follow-up Lookup */}
      <div className="lg:col-span-5 theme-surface p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold font-display">Follow-Up Lookup</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            Enter your case reference and 6-digit tracking code to view live status and timeline updates.
          </p>
        </div>

        <form onSubmit={handleLookup} className="space-y-3">
          <div>
            <label htmlFor="lookup-ref" className="block text-xs font-medium mb-1">
              Case Reference
            </label>
            <input
              id="lookup-ref"
              type="text"
              value={lookupRef}
              onChange={(e) => setLookupRef(e.target.value)}
              placeholder="INC-2026-000001"
              className="w-full px-3 py-2 text-xs font-mono-tabular theme-input"
            />
          </div>
          <div>
            <label htmlFor="lookup-code" className="block text-xs font-medium mb-1">
              6-Digit Tracking PIN
            </label>
            <input
              id="lookup-code"
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full px-3 py-2 text-xs font-mono-tabular theme-input"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold theme-btn-secondary cursor-pointer min-h-[40px]"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Check Ticket Status</span>
          </button>
        </form>

        {lookupError && (
          <p className="text-xs" style={{ color: 'var(--t-crit)' }}>
            {lookupError}
          </p>
        )}

        {lookupResult && (
          <div className="p-4 theme-surface-alt space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono-tabular font-semibold">
                {lookupResult.caseRecord.ref}
              </span>
              <SeverityBadge severity={lookupResult.caseRecord.priority} compact />
            </div>
            <p className="text-sm font-semibold">{lookupResult.caseRecord.title}</p>
            <p className="text-xs font-mono-tabular" style={{ color: 'var(--t-accent)' }}>
              Current Status: {lookupResult.caseRecord.status.toUpperCase()}
            </p>
            <div className="space-y-1.5 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
              {lookupResult.events.map((ev) => (
                <div key={ev.id} className="text-xs">
                  <span className="font-mono-tabular" style={{ color: 'var(--t-text-dim)' }}>
                    [{ev.createdAt.slice(11, 19)}]
                  </span>{' '}
                  <span>{ev.body}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
