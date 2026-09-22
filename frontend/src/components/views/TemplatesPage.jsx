// frontend/src/components/views/TemplatesPage.jsx - 100 TEMPLATES LIVE REAL
import React, { useState } from 'react';
import { boards as boardsApi, tasks as tasksApi } from '../../services/api';

export default function TemplatesPage({ bgCard, setViewMode }) {
  const [creating, setCreating] = useState(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const templates = [
    { name: 'Product Launch', category: 'Marketing', description: 'Coordinate milestones, launch tasks, and stakeholder approvals.', tiles: ['Define roadmap', 'Create campaign assets', 'Final launch checklist'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Content Calendar', category: 'Marketing', description: 'Plan editorial calendar, content creation and publishing schedule.', tiles: ['Content ideas', 'Draft & review', 'Publish & promote'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'SEO Campaign', category: 'Marketing', description: 'Track keyword research, on-page optimization and backlink outreach.', tiles: ['Keyword research', 'On-page SEO', 'Link building'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Social Media Plan', category: 'Marketing', description: 'Schedule posts, engagement and monthly performance report.', tiles: ['Content planning', 'Scheduling', 'Analytics report'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Email Marketing', category: 'Marketing', description: 'Design email flows, segmentation and A/B testing for campaigns.', tiles: ['List segmentation', 'Email design', 'A/B test & send'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Influencer Campaign', category: 'Marketing', description: 'Find influencers, manage outreach and track campaign ROI.', tiles: ['Influencer discovery', 'Outreach & contract', 'Track ROI'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Brand Guidelines', category: 'Marketing', description: 'Define brand voice, visual identity and usage guidelines.', tiles: ['Voice & tone', 'Visual system', 'Guideline docs'], accent: 'from-red-500 to-rose-500' },
    { name: 'Market Research', category: 'Marketing', description: 'Conduct surveys, competitor analysis and insights synthesis.', tiles: ['Survey design', 'Competitor analysis', 'Insights report'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Ad Campaign', category: 'Marketing', description: 'Plan ad creatives, budget allocation and performance optimization.', tiles: ['Creative assets', 'Budget setup', 'Optimize performance'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Webinar Launch', category: 'Marketing', description: 'Prepare webinar content, promotion and post-event follow-up.', tiles: ['Content prep', 'Promotion', 'Follow-up & replay'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Engineering Sprint', category: 'Development', description: 'Manage sprint planning, issue triage, QA, and release readiness.', tiles: ['Sprint planning', 'Backlog grooming', 'QA & release'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Bug Tracking', category: 'Development', description: 'Triage bugs, prioritize fixes and track resolution progress.', tiles: ['Bug reported', 'Triage & assign', 'Fix & verify'], accent: 'from-red-500 to-rose-500' },
    { name: 'Feature Release', category: 'Development', description: 'Scope feature, development and release communication.', tiles: ['Scope feature', 'Development', 'Release comms'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Code Review', category: 'Development', description: 'Standardize PR review, feedback and merge checklist.', tiles: ['PR submission', 'Review feedback', 'Merge & deploy'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'API Development', category: 'Development', description: 'Design endpoints, implement and document API.', tiles: ['Design endpoints', 'Implementation', 'Docs & testing'], accent: 'from-amber-500 to-orange-500' },
    { name: 'QA Testing', category: 'Development', description: 'Create test plans, execute test cases and report bugs.', tiles: ['Test plan', 'Execute cases', 'Bug report'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'DevOps Pipeline', category: 'Development', description: 'Setup CI/CD, infrastructure and monitoring alerts.', tiles: ['CI/CD setup', 'Infra as code', 'Monitoring'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Technical Debt', category: 'Development', description: 'Audit legacy code, prioritize refactor and track progress.', tiles: ['Audit code', 'Prioritize debt', 'Refactor'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Mobile App Release', category: 'Development', description: 'Plan app store assets, beta testing and release.', tiles: ['Store assets', 'Beta testing', 'App release'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Security Audit', category: 'Development', description: 'Run vulnerability scan, remediation and compliance check.', tiles: ['Vuln scan', 'Remediation', 'Compliance'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Design System', category: 'Design', description: 'Review design tokens, components and documentation updates.', tiles: ['Component audit', 'Design review', 'Docs update'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'UI Redesign', category: 'Design', description: 'Research, redesign screens and handoff for development.', tiles: ['Research', 'Redesign screens', 'Handoff'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'User Research', category: 'Design', description: 'Plan interviews, synthesize insights and share findings.', tiles: ['Interview plan', 'Synthesis', 'Share findings'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Wireframing', category: 'Design', description: 'Sketch low-fi wireframes, feedback and hi-fi conversion.', tiles: ['Low-fi sketches', 'Feedback loop', 'Hi-fi conversion'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Design Sprint', category: 'Design', description: '5-day sprint to ideate, prototype and test ideas quickly.', tiles: ['Ideate', 'Prototype', 'User test'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Brand Identity', category: 'Design', description: 'Create logo concepts, color palette and brand assets.', tiles: ['Logo concepts', 'Color & type', 'Brand assets'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Illustration Pack', category: 'Design', description: 'Brief, illustrate and export custom illustration set.', tiles: ['Brief & moodboard', 'Illustration', 'Export assets'], accent: 'from-red-500 to-rose-500' },
    { name: 'Icon Set Design', category: 'Design', description: 'Define icon grid, design set and export for dev.', tiles: ['Grid setup', 'Design icons', 'Export & handoff'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Landing Page Design', category: 'Design', description: 'Copy, design and optimize landing page for conversion.', tiles: ['Copywriting', 'Page design', 'Optimize CRO'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Design Handoff', category: 'Design', description: 'Prepare specs, assets and dev handoff checklist.', tiles: ['Specs & tokens', 'Asset export', 'Handoff meeting'], accent: 'from-emerald-500 to-teal-500' },

    { name: 'Sales Pipeline', category: 'Sales', description: 'Manage leads from prospect to negotiation and closed-won.', tiles: ['Lead qualification', 'Demo & proposal', 'Negotiation & close'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Lead Qualification', category: 'Sales', description: 'Score leads, discovery call and qualification criteria.', tiles: ['Lead scoring', 'Discovery call', 'Qualify'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Client Proposal', category: 'Sales', description: 'Draft proposal, pricing and client presentation.', tiles: ['Draft proposal', 'Pricing', 'Client presentation'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Contract Negotiation', category: 'Sales', description: 'Redline contract, legal review and final signature.', tiles: ['Redline draft', 'Legal review', 'Signature'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Sales Onboarding', category: 'Sales', description: 'Onboard new sales reps with playbook and training.', tiles: ['Playbook training', 'CRM training', 'Shadow calls'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Account Planning', category: 'Sales', description: 'Map accounts, stakeholders and expansion strategy.', tiles: ['Account mapping', 'Stakeholder map', 'Expansion plan'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Upsell Campaign', category: 'Sales', description: 'Identify upsell opportunities and outreach sequence.', tiles: ['Opportunity list', 'Outreach sequence', 'Close upsell'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Sales Forecast', category: 'Sales', description: 'Review pipeline, forecast revenue and risks.', tiles: ['Pipeline review', 'Forecast revenue', 'Risk analysis'], accent: 'from-red-500 to-rose-500' },
    { name: 'Partnership Outreach', category: 'Sales', description: 'Find partners, pitch and co-marketing plan.', tiles: ['Partner list', 'Pitch deck', 'Co-marketing'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'CRM Cleanup', category: 'Sales', description: 'Deduplicate contacts, update fields and hygiene check.', tiles: ['Deduplicate', 'Update fields', 'Hygiene check'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Event Planning', category: 'Operations', description: 'Coordinate venue, vendors, promotion and post-event followup.', tiles: ['Venue & vendors', 'Promotion plan', 'Event day & followup'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Customer Success', category: 'Operations', description: 'Track onboarding phases, renewals, health scoring, and follow-ups.', tiles: ['Client onboarding', 'Health score review', 'Renewal follow-up'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Vendor Management', category: 'Operations', description: 'Evaluate vendors, contract and performance review.', tiles: ['Vendor evaluation', 'Contracting', 'Performance review'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Process Improvement', category: 'Operations', description: 'Map current process, identify gaps and implement fix.', tiles: ['Map process', 'Gap analysis', 'Implement fix'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Inventory Audit', category: 'Operations', description: 'Count inventory, reconcile discrepancies and reorder.', tiles: ['Physical count', 'Reconcile', 'Reorder'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Office Setup', category: 'Operations', description: 'Plan office layout, procurement and move-in checklist.', tiles: ['Layout plan', 'Procurement', 'Move-in'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Remote Work Policy', category: 'Operations', description: 'Draft remote policy, tools setup and team training.', tiles: ['Policy draft', 'Tools setup', 'Team training'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Risk Assessment', category: 'Operations', description: 'Identify risks, impact analysis and mitigation plan.', tiles: ['Identify risks', 'Impact analysis', 'Mitigation'], accent: 'from-red-500 to-rose-500' },
    { name: 'Supply Chain', category: 'Operations', description: 'Track suppliers, logistics and delivery timeline.', tiles: ['Supplier list', 'Logistics plan', 'Delivery tracking'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Business Continuity', category: 'Operations', description: 'Create BCP, disaster recovery and testing schedule.', tiles: ['BCP draft', 'DR plan', 'Test schedule'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'HR Onboarding', category: 'People', description: 'Streamline new hire paperwork, training and team introductions.', tiles: ['Paperwork & access', 'Training plan', 'Team intro & buddy'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Employee Offboarding', category: 'People', description: 'Knowledge transfer, access revocation and exit interview.', tiles: ['Knowledge transfer', 'Revoke access', 'Exit interview'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Performance Review', category: 'People', description: 'Self review, manager feedback and goal setting.', tiles: ['Self review', 'Manager feedback', 'Goal setting'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Recruitment Pipeline', category: 'People', description: 'Sourcing, interview stages and offer management.', tiles: ['Sourcing', 'Interviews', 'Offer & close'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Training Program', category: 'People', description: 'Needs assessment, curriculum and training delivery.', tiles: ['Needs assessment', 'Curriculum', 'Delivery'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Company Culture', category: 'People', description: 'Define values, culture initiatives and team rituals.', tiles: ['Values workshop', 'Initiatives', 'Rituals'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Benefits Enrollment', category: 'People', description: 'Benefits comparison, enrollment and communication.', tiles: ['Benefits compare', 'Enrollment', 'Comms'], accent: 'from-red-500 to-rose-500' },
    { name: 'Diversity & Inclusion', category: 'People', description: 'Audit, training and D&I programs implementation.', tiles: ['Audit', 'Training', 'Programs'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Employee Engagement', category: 'People', description: 'Survey, action planning and engagement activities.', tiles: ['Survey', 'Action plan', 'Activities'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Compensation Review', category: 'People', description: 'Market benchmarking, bands and review cycle.', tiles: ['Market benchmark', 'Bands', 'Review cycle'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Finance Review', category: 'Finance', description: 'Oversight for approvals, invoice reviews, and monthly close cycles.', tiles: ['Expense approvals', 'Invoice review', 'Month-end closeout'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Budget Planning', category: 'Finance', description: 'Forecast revenue, allocate budget and approval workflow.', tiles: ['Revenue forecast', 'Allocation', 'Approval'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Expense Tracking', category: 'Finance', description: 'Collect receipts, categorization and reimbursement.', tiles: ['Collect receipts', 'Categorize', 'Reimbursement'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Invoice Management', category: 'Finance', description: 'Create invoice, send and payment follow-up.', tiles: ['Create invoice', 'Send', 'Payment follow-up'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Financial Reporting', category: 'Finance', description: 'Close books, generate reports and stakeholder review.', tiles: ['Close books', 'Generate reports', 'Stakeholder review'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Tax Preparation', category: 'Finance', description: 'Gather docs, filing and payment scheduling.', tiles: ['Gather docs', 'Filing', 'Payment'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Fundraising', category: 'Finance', description: 'Deck, investor outreach and term sheet negotiation.', tiles: ['Pitch deck', 'Outreach', 'Term sheet'], accent: 'from-red-500 to-rose-500' },
    { name: 'Payroll Process', category: 'Finance', description: 'Time tracking, payroll run and payslip distribution.', tiles: ['Time tracking', 'Payroll run', 'Payslips'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Cost Optimization', category: 'Finance', description: 'Audit spend, identify savings and implementation.', tiles: ['Spend audit', 'Savings ideas', 'Implement'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Audit Preparation', category: 'Finance', description: 'Gather evidence, auditor coordination and remediation.', tiles: ['Gather evidence', 'Auditor coord', 'Remediation'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Product Roadmap', category: 'Product', description: 'Define vision, prioritize themes and share roadmap.', tiles: ['Vision', 'Prioritize themes', 'Share roadmap'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Feature Prioritization', category: 'Product', description: 'Score features using RICE and prioritize backlog.', tiles: ['RICE scoring', 'Stack ranking', 'Backlog update'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'User Feedback', category: 'Product', description: 'Collect feedback, categorize and prioritize insights.', tiles: ['Collect', 'Categorize', 'Prioritize'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Beta Testing', category: 'Product', description: 'Recruit beta users, collect bugs and feedback loop.', tiles: ['Recruit beta', 'Track bugs', 'Feedback loop'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Product Analytics', category: 'Product', description: 'Define events, dashboards and insight sharing.', tiles: ['Define events', 'Build dashboards', 'Share insights'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Competitive Analysis', category: 'Product', description: 'Identify competitors, feature matrix and positioning.', tiles: ['Competitor list', 'Feature matrix', 'Positioning'], accent: 'from-violet-500 to-purple-500' },
    { name: 'PRD Writing', category: 'Product', description: 'Write PRD, review and get stakeholder approval.', tiles: ['Write PRD', 'Review', 'Approval'], accent: 'from-red-500 to-rose-500' },
    { name: 'Product Metrics', category: 'Product', description: 'Define North Star, KPIs and weekly review.', tiles: ['North Star', 'KPI dashboard', 'Weekly review'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Go-to-Market', category: 'Product', description: 'Launch plan, marketing assets and sales enablement.', tiles: ['Launch plan', 'Marketing assets', 'Sales enablement'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Customer Journey', category: 'Product', description: 'Map journey, pain points and optimization ideas.', tiles: ['Journey map', 'Pain points', 'Optimize'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Support Ticket Triage', category: 'Support', description: 'Prioritize tickets, assign and track resolution SLA.', tiles: ['Prioritize', 'Assign', 'Resolve & close'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Knowledge Base', category: 'Support', description: 'Audit articles, write new docs and publish updates.', tiles: ['Audit articles', 'Write docs', 'Publish'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Customer Onboarding', category: 'Support', description: 'Welcome email, setup guide and success check-in.', tiles: ['Welcome email', 'Setup guide', 'Success check'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Escalation Process', category: 'Support', description: 'Define escalation tiers, on-call and postmortem.', tiles: ['Tiers definition', 'On-call rota', 'Postmortem'], accent: 'from-amber-500 to-orange-500' },
    { name: 'SLA Management', category: 'Support', description: 'Define SLAs, monitor compliance and report breaches.', tiles: ['Define SLA', 'Monitor', 'Breach report'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Feedback Loop', category: 'Support', description: 'Collect feedback, route to product and close loop.', tiles: ['Collect feedback', 'Route to product', 'Close loop'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Churn Prevention', category: 'Support', description: 'Identify at-risk accounts, outreach and save playbook.', tiles: ['At-risk list', 'Outreach', 'Save playbook'], accent: 'from-red-500 to-rose-500' },
    { name: 'Community Building', category: 'Support', description: 'Create community spaces, moderation and engagement.', tiles: ['Create spaces', 'Moderation', 'Engagement plan'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Customer Survey', category: 'Support', description: 'Design survey, distribution and insights analysis.', tiles: ['Design survey', 'Distribute', 'Analyze insights'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Help Desk Setup', category: 'Support', description: 'Configure help desk, macros and team training.', tiles: ['Configure desk', 'Create macros', 'Team training'], accent: 'from-teal-500 to-cyan-500' },

    { name: 'Contract Review', category: 'Legal', description: 'Review contract clauses, risk assessment and approval.', tiles: ['Clause review', 'Risk assessment', 'Approval'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Compliance Checklist', category: 'Legal', description: 'List regulations, evidence gathering and audit prep.', tiles: ['List regs', 'Gather evidence', 'Audit prep'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Privacy Policy Update', category: 'Legal', description: 'Audit policy, legal review and publish update.', tiles: ['Audit policy', 'Legal review', 'Publish'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Terms of Service', category: 'Legal', description: 'Draft ToS, stakeholder review and versioning.', tiles: ['Draft ToS', 'Stakeholder review', 'Versioning'], accent: 'from-amber-500 to-orange-500' },
    { name: 'IP Management', category: 'Legal', description: 'Track IP assets, filings and renewal deadlines.', tiles: ['Track assets', 'Filings', 'Renewals'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Board Meeting Prep', category: 'Legal', description: 'Prepare deck, financials and board packet distribution.', tiles: ['Prepare deck', 'Financials', 'Packet distribution'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Policy Documentation', category: 'Legal', description: 'Draft policy, review cycle and employee attestation.', tiles: ['Draft policy', 'Review cycle', 'Attestation'], accent: 'from-red-500 to-rose-500' },
    { name: 'Licensing', category: 'Legal', description: 'Evaluate license needs, application and compliance.', tiles: ['Evaluate needs', 'Application', 'Compliance'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Legal Risk Review', category: 'Legal', description: 'Identify legal risks, mitigation plan and monitoring.', tiles: ['Identify risks', 'Mitigation plan', 'Monitoring'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Document Management', category: 'Legal', description: 'Organize docs, access control and retention policy.', tiles: ['Organize', 'Access control', 'Retention'], accent: 'from-teal-500 to-cyan-500' },
  ];

  const allCats = ['All',...Array.from(new Set(templates.map(t => t.category)))];
  const filtered = templates.filter(t => {
    const matchCat = cat === 'All' || t.category === cat;
    const matchQuery =!query || t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  const totalTasks = templates.reduce((s, t) => s + t.tiles.length, 0);
  const totalCategories = new Set(templates.map(t => t.category)).size;

  const stats = [
    { label: 'Live templates', value: templates.length, tone: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Showing', value: filtered.length, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Categories', value: totalCategories, tone: 'text-sky-600 dark:text-sky-400' },
  ];

  const handleUseTemplate = async (template) => {
    if (creating) return;
    setCreating(template.name);
    try {
      const res = await boardsApi.create(template.name);
      const boardId = res.data.id;
      for (const title of template.tiles) {
        await tasksApi.create({ title, status: 'todo', priority: 'medium', board_id: boardId, description: `Starter task from ${template.name} template` });
      }
      setViewMode('board');
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create from template');
    } finally {
      setCreating(null);
    }
  };

  const handleCreateScratch = async () => {
    const name = window.prompt('Board name:');
    if (!name?.trim()) return;
    try {
      await boardsApi.create(name.trim());
      setViewMode('board');
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create board');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Templates</p>
            <h2 className="mt-2 text-2xl font-bold">100 ready-made workflows for every team</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{filtered.length} of {templates.length} templates • {totalTasks} starter tasks</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates..." className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white w-full sm:w-56" />
            <select value={cat} onChange={e => setCat(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white">
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={() => setViewMode('dashboard')} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200">Dashboard</button>
            <button type="button" onClick={handleCreateScratch} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create from scratch</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {filtered.map((template) => (
          <div key={template.name} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className={`mb-4 h-28 rounded-2xl bg-gradient-to-br ${template.accent} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">{template.category}</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">{template.tiles.length} tasks</span>
              </div>
              <h3 className="mt-8 text-xl font-black truncate">{template.name}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{template.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {template.tiles.map((tile) => (
                <span key={tile} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">{tile}</span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{template.category} • {template.tiles.length} tasks</span>
              <button type="button" onClick={() => handleUseTemplate(template)} disabled={creating === template.name} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {creating === template.name? 'Creating...' : 'Use template'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}