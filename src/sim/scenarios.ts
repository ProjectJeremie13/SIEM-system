import type { Scenario, ScenarioKey, SegmentState } from '../domain/types';

export const INITIAL_SEGMENTS: SegmentState[] = [
  { name: 'WAN', criticality: 5, status: 'up', ownerTeam: 'Core Network' },
  { name: 'DMZ', criticality: 4, status: 'up', ownerTeam: 'Edge Security' },
  { name: 'Web Portal', criticality: 5, status: 'up', ownerTeam: 'Identity & Apps' },
  { name: 'API Gateway', criticality: 5, status: 'up', ownerTeam: 'Platform Eng' },
  { name: 'RPA Bots', criticality: 3, status: 'up', ownerTeam: 'Automation' },
  { name: 'VPN', criticality: 4, status: 'up', ownerTeam: 'Remote Access' },
];

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  bf: {
    schemaVersion: 1,
    key: 'bf',
    title: 'Failed-login surge (Credential Stuffing)',
    segment: 'Web Portal',
    metric: 'auth.failed',
    severity: 'high',
    mitre: ['T1110.004'],
    detectionKey: 'auth.credential_stuffing',
    detectionVersion: 3,
    defaultSourceIp: '203.0.113.50',
    symptom: [
      '38–42 failed logins/min on Web Portal (baseline 1–4/min)',
      'Single external source 203.0.113.50 cycling across 8 usernames',
      'One SUCCESS authentication observed immediately after burst',
    ],
    hints: [
      'Count authentication failures grouped by Source IP.',
      'One IP rotating across many distinct usernames indicates credential stuffing, not a typo.',
      'Check whether any attempt from 203.0.113.50 succeeded after the failures.',
    ],
    extendedHints: [
      'A locked-out human repeats a single username; automated stuffing cycles through a list from one source.',
      'Look at row LOG-001 in the Authentication table: tmoyo authenticated successfully after 22 failures.',
      'Proportionate containment: block/rate-limit 203.0.113.50 at edge, reset tmoyo credentials, revoke sessions, enforce MFA.',
    ],
    course: {
      what: 'A high-velocity burst of failed authentications from one external source IP testing stolen username/password pairs against Web Portal.',
      readLogs: 'Group FAIL events by Source IP, count distinct target usernames, then sort chronologically to verify if any account yielded a SUCCESS.',
      checklist: [
        'Group failures by Source IP and distinct username count',
        'Identify any post-burst SUCCESS event indicating compromise',
        'Verify MFA status on compromised accounts in the directory',
      ],
    },
    quiz: [
      {
        id: 'bf-q1',
        prompt: 'What attack pattern do the Web Portal authentication logs show?',
        options: [
          'A routine password expiration reminder wave',
          'Credential stuffing from a single external IP across multiple accounts',
          'An internal DNS misconfiguration causing gateway timeouts',
        ],
        answer: 1,
        why: 'One source IP (203.0.113.50) generated 22 rapid failures across 8 distinct usernames — classic credential stuffing.',
      },
      {
        id: 'bf-q2',
        prompt: 'Which source IP is responsible for the automated burst?',
        options: ['10.20.4.18', '198.51.100.14', '203.0.113.50'],
        answer: 2,
        why: 'Rows LOG-001 through LOG-023 trace the burst directly to 203.0.113.50.',
      },
      {
        id: 'bf-q3',
        prompt: 'Which account requires immediate credential reset and session revocation?',
        options: ['tmoyo (SUCCESS after burst, MFA disabled)', 'jchen (zero failures)', 'svc-backup (internal service)'],
        answer: 0,
        why: 'LOG-001 records a SUCCESS for tmoyo immediately following the 22 failures, and the directory shows MFA disabled.',
      },
      {
        id: 'bf-q4',
        prompt: 'What is the most proportionate immediate containment action?',
        options: [
          'Shut down the entire Web Portal segment for all customers',
          'Block or rate-limit 203.0.113.50 and revoke active sessions for tmoyo',
          'Delete all accounts that experienced a failed login',
        ],
        answer: 1,
        why: 'Targeted IP containment and session revocation stop the adversary without taking down legitimate users.',
      },
      {
        id: 'bf-q5',
        prompt: 'Which long-term control best prevents recurrence of this compromise?',
        options: [
          'Enforce phishing-resistant MFA and adaptive rate limiting on /login',
          'Disable authentication logging to reduce noise',
          'Allow unlimited login retries from trusted countries',
        ],
        answer: 0,
        why: 'MFA blocks credential reuse even when passwords are leaked, and rate limiting slows automated bursts.',
      },
    ],
    skill: 'Authentication Log Forensics & Credential Stuffing Containment',
    concept: 'Distinguish automated credential stuffing from human lockouts, confirm whether compromise occurred, and contain without disrupting legitimate traffic.',
    fixture: {
      logins: [
        { id: 'LOG-001', ts: 'T-00:04', srcIp: '203.0.113.50', username: 'tmoyo', outcome: 'SUCCESS', endpoint: '/login', latencyMs: 112 },
        { id: 'LOG-002', ts: 'T-00:07', srcIp: '203.0.113.50', username: 'tmoyo', outcome: 'FAIL', endpoint: '/login', latencyMs: 42 },
        { id: 'LOG-003', ts: 'T-00:09', srcIp: '203.0.113.50', username: 'akumalo', outcome: 'FAIL', endpoint: '/login', latencyMs: 39 },
        { id: 'LOG-004', ts: 'T-00:11', srcIp: '203.0.113.50', username: 'dpatel', outcome: 'FAIL', endpoint: '/login', latencyMs: 41 },
        { id: 'LOG-005', ts: 'T-00:13', srcIp: '203.0.113.50', username: 'lncube', outcome: 'FAIL', endpoint: '/login', latencyMs: 38 },
        { id: 'LOG-006', ts: 'T-00:15', srcIp: '203.0.113.50', username: 'rhendriks', outcome: 'FAIL', endpoint: '/login', latencyMs: 44 },
        { id: 'LOG-007', ts: 'T-00:17', srcIp: '203.0.113.50', username: 'mnaidoo', outcome: 'FAIL', endpoint: '/login', latencyMs: 40 },
        { id: 'LOG-008', ts: 'T-00:19', srcIp: '203.0.113.50', username: 'sjohnson', outcome: 'FAIL', endpoint: '/login', latencyMs: 37 },
        { id: 'LOG-009', ts: 'T-00:21', srcIp: '203.0.113.50', username: 'admin-ops', outcome: 'FAIL', endpoint: '/login', latencyMs: 41 },
        { id: 'LOG-010', ts: 'T-00:24', srcIp: '198.51.100.14', username: 'jchen', outcome: 'SUCCESS', endpoint: '/login', latencyMs: 95 },
      ],
      network: [
        { id: 'NET-001', ts: 'T-00:05', host: 'web-edge-01', destination: '203.0.113.50', mbps: 4.2, rttMs: 28, lossPct: 0.0, protocol: 'HTTPS' },
        { id: 'NET-002', ts: 'T-00:12', host: 'web-edge-01', destination: '198.51.100.14', mbps: 1.8, rttMs: 21, lossPct: 0.0, protocol: 'HTTPS' },
      ],
      users: [
        { id: 'USR-001', username: 'tmoyo', department: 'Finance', mfaEnabled: false, riskFlag: 'Post-burst auth success' },
        { id: 'USR-002', username: 'akumalo', department: 'Operations', mfaEnabled: true, riskFlag: 'Targeted in spray' },
        { id: 'USR-003', username: 'jchen', department: 'Engineering', mfaEnabled: true, riskFlag: 'Normal session' },
      ],
    },
  },
  slow: {
    schemaVersion: 1,
    key: 'slow',
    title: 'Bandwidth saturation (Business-Hours Backup)',
    segment: 'WAN',
    metric: 'net.throughput',
    severity: 'high',
    mitre: ['T1499'],
    detectionKey: 'net.bandwidth_saturation',
    detectionVersion: 2,
    defaultSourceIp: '10.20.8.44',
    symptom: [
      'Available WAN throughput dropped from 95 Mbps to ~34 Mbps',
      'Latency moderate (~32 ms), packet loss near 0% — link is saturated, not broken',
      'Internal host BACKUP-SRV sustaining 62 Mbps outbound to cloud backup endpoint',
    ],
    hints: [
      'Check network telemetry for a single internal host consuming disproportionate outbound Mbps.',
      'Low packet loss with steady RTT indicates congestion from volume, not a faulty ISP circuit.',
      'Throttle or pause the scheduled backup job rather than cutting off the entire WAN.',
    ],
    extendedHints: [
      'NET-101 shows BACKUP-SRV (10.20.8.44) pushing 62.4 Mbps to cloud-vault-eu over TLS.',
      'Applying QoS shaping or rescheduling backups to 22:00–05:00 restores user capacity immediately.',
      'Taking down WAN would cause a self-inflicted total outage.',
    ],
    course: {
      what: 'An unthrottled backup transfer running during peak hours is saturating the WAN uplink and starving interactive business traffic.',
      readLogs: 'Compare per-host Mbps against RTT and packet loss. High Mbps + normal RTT/loss points to a local bandwidth hog rather than an ISP fault.',
      checklist: [
        'Identify top bandwidth talker in network flow logs',
        'Verify packet loss and RTT to rule out upstream circuit failure',
        'Apply QoS cap or reschedule batch transfer off-peak',
      ],
    },
    quiz: [
      {
        id: 'slow-q1',
        prompt: 'What is causing the WAN throughput drop?',
        options: [
          'An upstream BGP route hijack',
          'BACKUP-SRV saturating the uplink with an unthrottled cloud backup',
          'Credential stuffing against the VPN concentrator',
        ],
        answer: 1,
        why: 'NET-101 shows BACKUP-SRV consuming 62.4 Mbps outbound during business hours.',
      },
      {
        id: 'slow-q2',
        prompt: 'Which telemetry detail proves this is local saturation rather than an ISP outage?',
        options: [
          'Packet loss is 0.1% and RTT is a steady 31 ms',
          'Three users failed to log in',
          'All ports on the firewall are closed',
        ],
        answer: 0,
        why: 'Upstream circuit faults show elevated loss (5%+) and spiking RTT; steady RTT with 0.1% loss indicates queue saturation.',
      },
      {
        id: 'slow-q3',
        prompt: 'Which internal host is the top talker?',
        options: ['web-edge-01', 'BACKUP-SRV (10.20.8.44)', 'rpa-worker-03'],
        answer: 1,
        why: 'NET-101 identifies BACKUP-SRV at 62.4 Mbps.',
      },
      {
        id: 'slow-q4',
        prompt: 'What is the correct immediate response?',
        options: [
          'Disable the WAN segment entirely',
          'Apply a QoS bandwidth cap or pause the backup job until off-peak hours',
          'Reset every employee password',
        ],
        answer: 1,
        why: 'Throttling or pausing the batch job restores interactive throughput without interrupting the business.',
      },
      {
        id: 'slow-q5',
        prompt: 'How should this be prevented from recurring?',
        options: [
          'Enforce maintenance-window scheduling and QoS traffic shaping for backup jobs',
          'Stop taking backups permanently',
          'Double user login thresholds',
        ],
        answer: 0,
        why: 'Off-peak schedules combined with QoS ceilings guarantee interactive traffic priority.',
      },
    ],
    skill: 'Network Capacity Triage & Proportionate QoS Containment',
    concept: 'Separate local saturation from upstream degradation using RTT/loss telemetry, then throttle the source without causing a wider outage.',
    fixture: {
      logins: [
        { id: 'LOG-101', ts: 'T-00:08', srcIp: '10.20.1.15', username: 'mnaidoo', outcome: 'SUCCESS', endpoint: '/sso', latencyMs: 145 },
      ],
      network: [
        { id: 'NET-101', ts: 'T-00:03', host: 'BACKUP-SRV (10.20.8.44)', destination: 'cloud-vault-eu:443', mbps: 62.4, rttMs: 31, lossPct: 0.1, protocol: 'TLS' },
        { id: 'NET-102', ts: 'T-00:06', host: 'app-proxy-02', destination: 'erp-core:8443', mbps: 8.1, rttMs: 29, lossPct: 0.0, protocol: 'HTTPS' },
        { id: 'NET-103', ts: 'T-00:09', host: 'voip-sbc-01', destination: 'sip-carrier:5061', mbps: 3.4, rttMs: 34, lossPct: 0.2, protocol: 'SRTP' },
      ],
      users: [
        { id: 'USR-101', username: 'svc-backup', department: 'Infrastructure', mfaEnabled: true, riskFlag: 'Unthrottled daytime job' },
      ],
    },
  },
  lat: {
    schemaVersion: 1,
    key: 'lat',
    title: 'Upstream ISP latency & packet loss',
    segment: 'VPN',
    metric: 'net.throughput',
    severity: 'medium',
    mitre: ['T1498'],
    detectionKey: 'net.upstream_degradation',
    detectionVersion: 1,
    defaultSourceIp: '198.51.100.201',
    symptom: [
      'VPN throughput degraded to ~48 Mbps without any high-volume internal talker',
      'Round-trip time spiked to 195–260 ms with 5–9% packet loss at isp-gw-ct1',
      'TCP retransmissions affecting remote desktop and API gateway sessions',
    ],
    hints: [
      'Look at RTT (ms) and Loss (%) across all network hops.',
      'Low Mbps combined with >5% packet loss and >200ms RTT points to an upstream carrier fault.',
      'Local QoS throttling will not fix upstream packet loss; fail over to the secondary link and escalate to the ISP.',
    ],
    extendedHints: [
      'NET-201 and NET-202 show normal bandwidth (11–14 Mbps) but 245ms RTT and 7.8% loss at hop isp-gw-ct1.',
      'NET-203 confirms vpn-gw-02 on the secondary ISP link has 22 ms RTT and 0.0% packet loss.',
      'Document exact UTC timestamps, RTT, and loss percentages when opening the carrier incident.',
    ],
    course: {
      what: 'Upstream ISP path congestion or optical degradation at isp-gw-ct1 is causing high latency and packet loss across VPN tunnels.',
      readLogs: 'Compare per-host Mbps with RTT and packet loss. Elevated loss + high RTT + modest Mbps means external path impairment.',
      checklist: [
        'Confirm absence of a local bandwidth hog',
        'Verify RTT > 180 ms and packet loss > 5% on upstream gateway',
        'Fail over VPN traffic to secondary ISP link and open carrier ticket',
      ],
    },
    quiz: [
      {
        id: 'lat-q1',
        prompt: 'What distinguishes this incident from a local bandwidth hog?',
        options: [
          'Throughput per host is modest (11–14 Mbps), while RTT is 245 ms and packet loss is 7.8%',
          'BACKUP-SRV is transferring 90 Mbps',
          'Failed logins exceeded 40 per minute',
        ],
        answer: 0,
        why: 'Modest throughput paired with high RTT and packet loss proves the bottleneck is external path degradation.',
      },
      {
        id: 'lat-q2',
        prompt: 'Which upstream hop exhibits the packet loss and latency spike?',
        options: ['web-edge-01', 'isp-gw-ct1 (198.51.100.201)', 'BACKUP-SRV'],
        answer: 1,
        why: 'NET-201 and NET-202 isolate the degradation at isp-gw-ct1.',
      },
      {
        id: 'lat-q3',
        prompt: 'What immediate action restores VPN stability for remote staff?',
        options: [
          'Fail over VPN routing to the secondary ISP circuit',
          'Block all outbound HTTPS traffic',
          'Force password resets for all VPN users',
        ],
        answer: 0,
        why: 'Routing around the impaired carrier hop restores clean RTT and zero packet loss.',
      },
      {
        id: 'lat-q4',
        prompt: 'What evidence must accompany the ISP escalation ticket?',
        options: [
          'Exact UTC timestamps, affected gateway IP, RTT measurements, and packet loss percentages',
          'A list of internal employee passwords',
          'Only a screenshot of the login page',
        ],
        answer: 0,
        why: 'Carriers require timestamped path metrics (RTT and loss %) to locate and clear peering faults.',
      },
      {
        id: 'lat-q5',
        prompt: 'Which architectural improvement reduces future impact from carrier faults?',
        options: [
          'Automated SD-WAN health probes that fail over when RTT or loss crosses SLA thresholds',
          'Removing the secondary ISP link to simplify routing',
          'Increasing the alert threshold to 500 ms',
        ],
        answer: 0,
        why: 'Automated SLA probes shift traffic before users experience sustained disconnects.',
      },
    ],
    skill: 'Upstream Path Diagnostics & Carrier Failover Escalation',
    concept: 'Differentiate external path loss from local saturation using RTT/loss telemetry, execute failover, and escalate with timestamped metrics.',
    fixture: {
      logins: [
        { id: 'LOG-201', ts: 'T-00:05', srcIp: '198.51.100.88', username: 'rhendriks', outcome: 'SUCCESS', endpoint: '/vpn-auth', latencyMs: 490 },
      ],
      network: [
        { id: 'NET-201', ts: 'T-00:04', host: 'vpn-gw-01', destination: 'isp-gw-ct1 (198.51.100.201)', mbps: 14.2, rttMs: 245, lossPct: 7.8, protocol: 'WireGuard' },
        { id: 'NET-202', ts: 'T-00:08', host: 'vpn-gw-01', destination: 'isp-gw-ct1 (198.51.100.201)', mbps: 11.6, rttMs: 218, lossPct: 6.1, protocol: 'HTTPS' },
        { id: 'NET-203', ts: 'T-00:10', host: 'vpn-gw-02 (backup)', destination: 'isp-gw-sec (203.0.113.9)', mbps: 4.5, rttMs: 22, lossPct: 0.0, protocol: 'WireGuard' },
      ],
      users: [
        { id: 'USR-201', username: 'rhendriks', department: 'Field Ops', mfaEnabled: true, riskFlag: 'Experiencing VPN drops' },
      ],
    },
  },
};
