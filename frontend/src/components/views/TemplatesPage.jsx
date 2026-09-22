import React, { useState, useMemo } from 'react';
import { boards as boardsApi, tasks as tasksApi } from '../../services/api';

export default function TemplatesPage({ bgCard, setViewMode }) {
  const [creating, setCreating] = useState(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Expanded templates library
  const templates = useMemo(() => [
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
    { name: 'Podcast Production', category: 'Marketing', description: 'Guest booking, recording schedule and episode promotion.', tiles: ['Book guests', 'Record & edit', 'Publish episode'], accent: 'from-indigo-500 to-blue-500' },
    { name: 'Affiliate Program', category: 'Marketing', description: 'Set up affiliate tiers, recruit partners and track payouts.', tiles: ['Set tiers', 'Recruit partners', 'Process payouts'], accent: 'from-purple-500 to-fuchsia-500' },
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
    { name: 'Database Migration', category: 'Development', description: 'Plan schema changes, script writing and data transfer.', tiles: ['Schema design', 'Migration script', 'Data verification'], accent: 'from-gray-500 to-slate-500' },
    { name: 'Architecture Review', category: 'Development', description: 'System design, scalability planning and review meetings.', tiles: ['System design', 'Scalability check', 'Final review'], accent: 'from-indigo-600 to-blue-600' },
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
    { name: '3D Modeling', category: 'Design', description: 'Concept modeling, texturing and rendering.', tiles: ['Base mesh', 'Texturing', 'Final render'], accent: 'from-purple-500 to-indigo-500' },
    { name: 'Motion Graphics', category: 'Design', description: 'Storyboard, animation and final export.', tiles: ['Storyboard', 'Animation', 'Export video'], accent: 'from-pink-500 to-rose-500' },
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
    { name: 'Cold Calling', category: 'Sales', description: 'Script prep, call list and follow-up logging.', tiles: ['Script prep', 'Make calls', 'Log follow-ups'], accent: 'from-orange-500 to-red-500' },
    { name: 'Trade Show Prep', category: 'Sales', description: 'Booth design, rep scheduling and lead capture setup.', tiles: ['Booth prep', 'Schedule reps', 'Lead capture'], accent: 'from-blue-600 to-indigo-600' },
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
    { name: 'Fleet Management', category: 'Operations', description: 'Vehicle maintenance, routing and driver scheduling.', tiles: ['Maintenance check', 'Route planning', 'Driver schedule'], accent: 'from-slate-500 to-gray-500' },
    { name: 'Facilities Maintenance', category: 'Operations', description: 'HVAC checks, cleaning schedules and repair logs.', tiles: ['HVAC check', 'Cleaning schedule', 'Repair log'], accent: 'from-cyan-500 to-blue-500' },
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
    { name: 'Course Planning', category: 'Education', description: 'Plan syllabus, lessons and assessments for semester.', tiles: ['Syllabus', 'Lesson plans', 'Assessments'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Student Onboarding', category: 'Education', description: 'Welcome students, orientation and resource access.', tiles: ['Welcome pack', 'Orientation', 'Resource access'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Curriculum Development', category: 'Education', description: 'Design curriculum, learning objectives and materials.', tiles: ['Objectives', 'Materials', 'Review'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Exam Preparation', category: 'Education', description: 'Create exam schedule, question papers and grading.', tiles: ['Schedule', 'Question papers', 'Grading'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Assignment Tracking', category: 'Education', description: 'Assign tasks, submission tracking and feedback.', tiles: ['Assign', 'Track submissions', 'Feedback'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Class Scheduling', category: 'Education', description: 'Timetable, room allocation and teacher assignment.', tiles: ['Timetable', 'Room allocation', 'Teacher assign'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Parent Communication', category: 'Education', description: 'Parent updates, meetings and progress reports.', tiles: ['Updates', 'Meetings', 'Progress reports'], accent: 'from-red-500 to-rose-500' },
    { name: 'School Event', category: 'Education', description: 'Plan school events, logistics and student participation.', tiles: ['Planning', 'Logistics', 'Participation'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Library Management', category: 'Education', description: 'Catalog books, issuing and inventory audit.', tiles: ['Catalog', 'Issuing', 'Audit'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Alumni Engagement', category: 'Education', description: 'Alumni database, events and donation drives.', tiles: ['Database', 'Alumni events', 'Donations'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Patient Intake', category: 'Healthcare', description: 'Registration, insurance verification and triage.', tiles: ['Registration', 'Insurance', 'Triage'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Clinical Trial', category: 'Healthcare', description: 'Protocol design, recruitment and monitoring.', tiles: ['Protocol', 'Recruitment', 'Monitoring'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Medical Records', category: 'Healthcare', description: 'Digitize records, access control and compliance.', tiles: ['Digitize', 'Access control', 'Compliance'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Appointment Scheduling', category: 'Healthcare', description: 'Doctor availability, booking and reminders.', tiles: ['Availability', 'Booking', 'Reminders'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Care Plan', category: 'Healthcare', description: 'Diagnosis, care plan creation and follow-up.', tiles: ['Diagnosis', 'Care plan', 'Follow-up'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Lab Testing', category: 'Healthcare', description: 'Sample collection, testing and report delivery.', tiles: ['Collection', 'Testing', 'Report delivery'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Prescription Management', category: 'Healthcare', description: 'Prescribe, pharmacy coordination and refills.', tiles: ['Prescribe', 'Pharmacy coord', 'Refills'], accent: 'from-red-500 to-rose-500' },
    { name: 'Health Campaign', category: 'Healthcare', description: 'Awareness campaign planning and community outreach.', tiles: ['Campaign plan', 'Outreach', 'Impact measure'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Staff Rotation', category: 'Healthcare', description: 'Shift planning, handover and coverage check.', tiles: ['Shift planning', 'Handover', 'Coverage'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Emergency Response', category: 'Healthcare', description: 'Emergency protocol, team drill and equipment check.', tiles: ['Protocol', 'Team drill', 'Equipment check'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Pitch Deck Prep', category: 'Startup', description: 'Storyline, deck design and investor Q&A prep.', tiles: ['Storyline', 'Deck design', 'Q&A prep'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'MVP Development', category: 'Startup', description: 'Define MVP scope, build and user testing.', tiles: ['MVP scope', 'Build', 'User testing'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Investor Outreach', category: 'Startup', description: 'Investor list, outreach emails and meeting follow-ups.', tiles: ['Investor list', 'Outreach', 'Follow-ups'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Startup Legal Setup', category: 'Startup', description: 'Incorporation, equity split and legal docs.', tiles: ['Incorporation', 'Equity split', 'Legal docs'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Co-founder Alignment', category: 'Startup', description: 'Roles, vision alignment and operating agreement.', tiles: ['Roles', 'Vision alignment', 'Operating agreement'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'User Acquisition', category: 'Startup', description: 'Acquisition channels, experiments and growth metrics.', tiles: ['Channels', 'Experiments', 'Growth metrics'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Pricing Strategy', category: 'Startup', description: 'Market pricing, packaging and pricing tests.', tiles: ['Market pricing', 'Packaging', 'Pricing tests'], accent: 'from-red-500 to-rose-500' },
    { name: 'Startup Hiring', category: 'Startup', description: 'First hires, job descriptions and interview process.', tiles: ['First hires', 'JDs', 'Interviews'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Accelerator Application', category: 'Startup', description: 'Application draft, video pitch and references.', tiles: ['Application draft', 'Video pitch', 'References'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Product Hunt Launch', category: 'Startup', description: 'Launch assets, hunter outreach and launch day ops.', tiles: ['Launch assets', 'Hunter outreach', 'Launch day'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Store Setup', category: 'E-commerce', description: 'Platform setup, theme and payment gateway.', tiles: ['Platform setup', 'Theme', 'Payment gateway'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Product Sourcing', category: 'E-commerce', description: 'Supplier research, samples and negotiation.', tiles: ['Supplier research', 'Samples', 'Negotiation'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Inventory Management', category: 'E-commerce', description: 'Stock tracking, reorder alerts and warehouse.', tiles: ['Stock tracking', 'Reorder alerts', 'Warehouse'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Order Fulfillment', category: 'E-commerce', description: 'Order picking, packing and shipping label.', tiles: ['Picking', 'Packing', 'Shipping label'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Returns Process', category: 'E-commerce', description: 'Return policy, RMA flow and refund processing.', tiles: ['Return policy', 'RMA flow', 'Refund'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Customer Reviews', category: 'E-commerce', description: 'Review request, moderation and response.', tiles: ['Request reviews', 'Moderation', 'Response'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Loyalty Program', category: 'E-commerce', description: 'Points system, rewards and promotion.', tiles: ['Points system', 'Rewards', 'Promotion'], accent: 'from-red-500 to-rose-500' },
    { name: 'Seasonal Sale', category: 'E-commerce', description: 'Sale planning, creatives and performance tracking.', tiles: ['Sale plan', 'Creatives', 'Performance tracking'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Dropshipping Setup', category: 'E-commerce', description: 'Find dropshippers, import products and automate orders.', tiles: ['Find dropshippers', 'Import products', 'Automate orders'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Marketplace Listing', category: 'E-commerce', description: 'Optimize listings for Amazon, Etsy and other marketplaces.', tiles: ['Listing copy', 'SEO', 'Pricing'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Property Listing', category: 'Real Estate', description: 'Photos, listing description and portals syndication.', tiles: ['Photos', 'Description', 'Syndication'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Buyer Journey', category: 'Real Estate', description: 'Buyer consultation, property tours and offer management.', tiles: ['Consultation', 'Tours', 'Offer management'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Open House', category: 'Real Estate', description: 'Open house prep, promotion and lead capture.', tiles: ['Prep', 'Promotion', 'Lead capture'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Lease Management', category: 'Real Estate', description: 'Lease drafting, tenant screening and renewal tracking.', tiles: ['Draft lease', 'Screening', 'Renewal tracking'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Property Inspection', category: 'Real Estate', description: 'Inspection checklist, report and repair negotiation.', tiles: ['Checklist', 'Report', 'Repair negotiation'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Mortgage Process', category: 'Real Estate', description: 'Pre-approval, documents and closing coordination.', tiles: ['Pre-approval', 'Documents', 'Closing'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Renovation Project', category: 'Real Estate', description: 'Scope renovation, contractor and budget tracking.', tiles: ['Scope', 'Contractor', 'Budget tracking'], accent: 'from-red-500 to-rose-500' },
    { name: 'Tenant Onboarding', category: 'Real Estate', description: 'Welcome kit, rules briefing and maintenance contacts.', tiles: ['Welcome kit', 'Rules briefing', 'Maintenance contacts'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Property Marketing', category: 'Real Estate', description: 'Marketing plan, ads and lead nurturing.', tiles: ['Marketing plan', 'Ads', 'Lead nurturing'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Closing Checklist', category: 'Real Estate', description: 'Final walkthrough, docs and key handover.', tiles: ['Walkthrough', 'Docs', 'Key handover'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Site Preparation', category: 'Construction', description: 'Clear site, surveying and temporary facilities.', tiles: ['Clear site', 'Surveying', 'Temp facilities'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Blueprint Review', category: 'Construction', description: 'Review drawings, clash detection and approvals.', tiles: ['Review drawings', 'Clash detection', 'Approvals'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Permit Application', category: 'Construction', description: 'Permit docs, submission and follow-up.', tiles: ['Permit docs', 'Submission', 'Follow-up'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Contractor Bidding', category: 'Construction', description: 'Bid invitation, evaluation and award.', tiles: ['Invitation', 'Evaluation', 'Award'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Material Procurement', category: 'Construction', description: 'Material list, vendor quotes and delivery schedule.', tiles: ['Material list', 'Quotes', 'Delivery schedule'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Safety Inspection', category: 'Construction', description: 'Safety checklist, inspection and corrective actions.', tiles: ['Checklist', 'Inspection', 'Corrective actions'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Project Scheduling', category: 'Construction', description: 'Gantt creation, resource allocation and tracking.', tiles: ['Gantt', 'Resource allocation', 'Tracking'], accent: 'from-red-500 to-rose-500' },
    { name: 'Quality Control', category: 'Construction', description: 'QC plan, inspections and defect log.', tiles: ['QC plan', 'Inspections', 'Defect log'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Punch List', category: 'Construction', description: 'Final walkthrough, punch items and closure.', tiles: ['Walkthrough', 'Punch items', 'Closure'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Final Handover', category: 'Construction', description: 'As-built docs, warranties and client handover.', tiles: ['As-built docs', 'Warranties', 'Client handover'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Production Planning', category: 'Manufacturing', description: 'Demand forecast, capacity planning and scheduling.', tiles: ['Demand forecast', 'Capacity', 'Scheduling'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Quality Assurance', category: 'Manufacturing', description: 'QA standards, inspections and corrective action.', tiles: ['QA standards', 'Inspections', 'Corrective action'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Supplier Audit', category: 'Manufacturing', description: 'Audit checklist, site visit and audit report.', tiles: ['Checklist', 'Site visit', 'Audit report'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Equipment Maintenance', category: 'Manufacturing', description: 'Preventive schedule, maintenance log and spares.', tiles: ['Preventive schedule', 'Maintenance log', 'Spares'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Lean Manufacturing', category: 'Manufacturing', description: 'Value stream mapping, waste identification and Kaizen.', tiles: ['VSM', 'Waste identification', 'Kaizen'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'New Product Introduction', category: 'Manufacturing', description: 'NPI checklist, pilot run and scale-up.', tiles: ['NPI checklist', 'Pilot run', 'Scale-up'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Packaging Design', category: 'Manufacturing', description: 'Packaging brief, artwork and compliance check.', tiles: ['Brief', 'Artwork', 'Compliance check'], accent: 'from-red-500 to-rose-500' },
    { name: 'Shipping Logistics', category: 'Manufacturing', description: 'Freight booking, customs and delivery tracking.', tiles: ['Freight booking', 'Customs', 'Delivery tracking'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Waste Reduction', category: 'Manufacturing', description: 'Waste audit, reduction plan and monitoring.', tiles: ['Waste audit', 'Reduction plan', 'Monitoring'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Factory Safety', category: 'Manufacturing', description: 'Safety training, hazard assessment and drills.', tiles: ['Safety training', 'Hazard assessment', 'Drills'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Grant Writing', category: 'Nonprofit', description: 'Grant research, proposal writing and submission.', tiles: ['Research', 'Proposal writing', 'Submission'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Volunteer Management', category: 'Nonprofit', description: 'Recruit volunteers, scheduling and recognition.', tiles: ['Recruit', 'Scheduling', 'Recognition'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Donor Outreach', category: 'Nonprofit', description: 'Donor list, outreach campaign and stewardship.', tiles: ['Donor list', 'Outreach campaign', 'Stewardship'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Fundraising Event', category: 'Nonprofit', description: 'Event planning, ticket sales and donation tracking.', tiles: ['Event planning', 'Ticket sales', 'Donation tracking'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Program Evaluation', category: 'Nonprofit', description: 'Define metrics, data collection and impact analysis.', tiles: ['Define metrics', 'Data collection', 'Impact analysis'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Community Outreach', category: 'Nonprofit', description: 'Outreach plan, partnerships and engagement events.', tiles: ['Outreach plan', 'Partnerships', 'Engagement events'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Impact Report', category: 'Nonprofit', description: 'Collect stories, data visualization and report design.', tiles: ['Collect stories', 'Data viz', 'Report design'], accent: 'from-red-500 to-rose-500' },
    { name: 'Board Recruitment', category: 'Nonprofit', description: 'Board needs assessment, candidate search and onboarding.', tiles: ['Needs assessment', 'Candidate search', 'Onboarding'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Sponsorship Package', category: 'Nonprofit', description: 'Sponsor tiers, package design and outreach.', tiles: ['Sponsor tiers', 'Package design', 'Outreach'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Awareness Campaign', category: 'Nonprofit', description: 'Campaign messaging, channels and impact tracking.', tiles: ['Messaging', 'Channels', 'Impact tracking'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Client Discovery', category: 'Consulting', description: 'Discovery questions, stakeholder mapping and needs analysis.', tiles: ['Discovery questions', 'Stakeholder map', 'Needs analysis'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Proposal Development', category: 'Consulting', description: 'Scope, pricing and proposal deck creation.', tiles: ['Scope', 'Pricing', 'Proposal deck'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Project Kickoff', category: 'Consulting', description: 'Kickoff agenda, roles and success criteria.', tiles: ['Agenda', 'Roles', 'Success criteria'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Stakeholder Interviews', category: 'Consulting', description: 'Interview guide, scheduling and synthesis.', tiles: ['Interview guide', 'Scheduling', 'Synthesis'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Data Analysis', category: 'Consulting', description: 'Data collection, analysis and insights deck.', tiles: ['Data collection', 'Analysis', 'Insights deck'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Recommendations', category: 'Consulting', description: 'Options evaluation, recommendation and roadmap.', tiles: ['Options evaluation', 'Recommendation', 'Roadmap'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Implementation Plan', category: 'Consulting', description: 'Implementation phases, responsibilities and timeline.', tiles: ['Phases', 'Responsibilities', 'Timeline'], accent: 'from-red-500 to-rose-500' },
    { name: 'Change Management', category: 'Consulting', description: 'Change impact, communication and training plan.', tiles: ['Impact', 'Communication', 'Training'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Client Presentation', category: 'Consulting', description: 'Storyline, slides and rehearsal.', tiles: ['Storyline', 'Slides', 'Rehearsal'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Retainer Management', category: 'Consulting', description: 'Retainer scope, monthly reporting and renewals.', tiles: ['Scope', 'Monthly reporting', 'Renewals'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Literature Review', category: 'Research', description: 'Search papers, summarize and gap analysis.', tiles: ['Search papers', 'Summarize', 'Gap analysis'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Hypothesis Development', category: 'Research', description: 'Research questions, hypothesis and variables.', tiles: ['Research questions', 'Hypothesis', 'Variables'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Experiment Design', category: 'Research', description: 'Design experiments, controls and sample size.', tiles: ['Design', 'Controls', 'Sample size'], accent: 'from-sky-500 to-cyan-500' },
    { name: 'Data Collection', category: 'Research', description: 'Collection protocol, tools and quality check.', tiles: ['Protocol', 'Tools', 'Quality check'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Data Cleaning', category: 'Research', description: 'Remove outliers, format data and missing values.', tiles: ['Identify outliers', 'Format structuring', 'Impute missing'], accent: 'from-purple-500 to-fuchsia-500' },
    { name: 'Statistical Analysis', category: 'Research', description: 'Run tests, p-values and interpret significance.', tiles: ['Run tests', 'Check p-values', 'Interpret stats'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Peer Review', category: 'Research', description: 'Draft circulation, feedback incorporation and revision.', tiles: ['Circulation', 'Incorporate feedback', 'Revision'], accent: 'from-violet-500 to-purple-500' },
    { name: 'Publication Prep', category: 'Research', description: 'Journal selection, manuscript formatting and submission.', tiles: ['Journal selection', 'Formatting', 'Submission'], accent: 'from-red-500 to-rose-500' },
    { name: 'Grant Application', category: 'Research', description: 'Funding search, proposal writing and budget.', tiles: ['Funding search', 'Proposal writing', 'Budget'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Lab Notebook', category: 'Research', description: 'Daily logs, observations and protocol updates.', tiles: ['Daily logs', 'Observations', 'Protocol updates'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Research Ethics', category: 'Research', description: 'Ethics application, consent forms and approval.', tiles: ['Ethics application', 'Consent forms', 'Approval'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'IT Helpdesk', category: 'IT', description: 'Manage IT tickets, hardware requests and network issues.', tiles: ['Ticket triage', 'Hardware prep', 'Network fix'], accent: 'from-indigo-600 to-blue-600' },
    { name: 'Server Migration', category: 'IT', description: 'Plan downtime, backup data and migrate servers.', tiles: ['Downtime plan', 'Data backup', 'Migration execution'], accent: 'from-emerald-600 to-teal-600' },
    { name: 'Software Rollout', category: 'IT', description: 'Test software, draft comms and push deployment.', tiles: ['Testing phase', 'User comms', 'Deployment push'], accent: 'from-rose-600 to-red-600' },
    { name: 'On-Call Rota', category: 'IT', description: 'Set schedules, define escalation paths and handoffs.', tiles: ['Schedule creation', 'Escalation paths', 'Shift handoffs'], accent: 'from-amber-600 to-orange-600' },
    { name: 'Hardware Audit', category: 'IT', description: 'Log assets, check warranties and order replacements.', tiles: ['Asset logging', 'Warranty check', 'Order parts'], accent: 'from-violet-600 to-purple-600' },
    { name: 'Cloud Migration', category: 'IT', description: 'Assess infrastructure, select cloud provider and migrate.', tiles: ['Infra assessment', 'Provider choice', 'Migration run'], accent: 'from-sky-600 to-blue-600' },
    { name: 'Access Review', category: 'IT', description: 'Audit user permissions, revoke stale access and compliance.', tiles: ['Audit permissions', 'Revoke access', 'Compliance log'], accent: 'from-fuchsia-600 to-pink-600' },
    { name: 'Disaster Recovery', category: 'IT', description: 'Setup backups, define RTO/RPO and run drill.', tiles: ['Backup setup', 'Define metrics', 'Run drill'], accent: 'from-gray-600 to-slate-600' },
    { name: 'Game Concept', category: 'Game Dev', description: 'Define mechanics, storyline and art style.', tiles: ['Mechanics doc', 'Story outline', 'Art style guide'], accent: 'from-purple-500 to-indigo-500' },
    { name: 'Level Design', category: 'Game Dev', description: 'Greyboxing, asset placement and playtesting.', tiles: ['Greyboxing', 'Asset placement', 'Playtesting'], accent: 'from-green-500 to-emerald-500' },
    { name: 'Character Rigging', category: 'Game Dev', description: 'Bone setup, weight painting and animation test.', tiles: ['Bone setup', 'Weight painting', 'Anim test'], accent: 'from-red-500 to-orange-500' },
    { name: 'Audio Implementation', category: 'Game Dev', description: 'SFX creation, voice lines and engine mixing.', tiles: ['SFX creation', 'Voice lines', 'Engine mixing'], accent: 'from-blue-500 to-cyan-500' },
    { name: 'Game QA Testing', category: 'Game Dev', description: 'Boundary testing, bug logging and performance profiling.', tiles: ['Boundary tests', 'Bug logging', 'Performance profile'], accent: 'from-yellow-500 to-amber-500' },
    { name: 'Video Pre-production', category: 'Media', description: 'Scripting, casting and location scouting.', tiles: ['Scripting', 'Casting', 'Location scout'], accent: 'from-pink-500 to-rose-500' },
    { name: 'Film Shoot', category: 'Media', description: 'Call sheet, gear check and daily shooting schedule.', tiles: ['Call sheet', 'Gear check', 'Daily schedule'], accent: 'from-indigo-500 to-violet-500' },
    { name: 'Post-Production', category: 'Media', description: 'Editing, color grading and sound mixing.', tiles: ['Rough cut', 'Color grading', 'Sound mixing'], accent: 'from-emerald-500 to-teal-500' },
    { name: 'Book Publishing', category: 'Publishing', description: 'Drafting, developmental edit and cover design.', tiles: ['Draft completion', 'Dev edit', 'Cover design'], accent: 'from-amber-500 to-orange-500' },
    { name: 'Magazine Issue', category: 'Publishing', description: 'Article pitching, layout design and printing.', tiles: ['Article pitches', 'Layout design', 'Send to print'], accent: 'from-fuchsia-500 to-pink-500' },
    { name: 'Restaurant Opening', category: 'Hospitality', description: 'Menu design, staff hiring and soft launch.', tiles: ['Menu design', 'Staff hiring', 'Soft launch'], accent: 'from-red-500 to-rose-500' },
    { name: 'Kitchen Prep', category: 'Hospitality', description: 'Inventory check, ingredient prep and station setup.', tiles: ['Inventory check', 'Ingredient prep', 'Station setup'], accent: 'from-blue-500 to-indigo-500' },
    { name: 'Hotel Maintenance', category: 'Hospitality', description: 'Room checks, pool cleaning and HVAC service.', tiles: ['Room checks', 'Pool cleaning', 'HVAC service'], accent: 'from-teal-500 to-cyan-500' },
    { name: 'Travel Itinerary', category: 'Personal', description: 'Flight booking, hotel reservation and daily activities.', tiles: ['Flight booking', 'Hotel reservation', 'Daily activities'], accent: 'from-sky-500 to-blue-500' },
    { name: 'Wedding Planning', category: 'Personal', description: 'Guest list, venue booking and catering tasting.', tiles: ['Guest list', 'Venue booking', 'Catering tasting'], accent: 'from-pink-400 to-rose-400' },
    { name: 'Home Renovation', category: 'Personal', description: 'Budgeting, contractor quotes and material shopping.', tiles: ['Budgeting', 'Contractor quotes', 'Material shopping'], accent: 'from-stone-500 to-gray-500' },
    { name: 'Fitness Program', category: 'Personal', description: 'Goal setting, meal prep and workout tracking.', tiles: ['Goal setting', 'Meal prep', 'Workout tracking'], accent: 'from-green-500 to-emerald-500' },
  ], []);

  const allCats = ['All', ...Array.from(new Set(templates.map(t => t.category)))].sort();

  // Filter and Sort Logic
  const processedTemplates = useMemo(() => {
    let result = templates.filter(t => {
      const matchCat = cat === 'All' || t.category === cat;
      const matchQuery = !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    });

    if (sortBy === 'az') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'za') result.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === 'tasks-high') result.sort((a, b) => b.tiles.length - a.tiles.length);
    if (sortBy === 'tasks-low') result.sort((a, b) => a.tiles.length - b.tiles.length);

    return result;
  }, [templates, cat, query, sortBy]);

  // Pagination Logic
  const totalPages = Math.ceil(processedTemplates.length / itemsPerPage);
  const currentTemplates = processedTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalTasks = templates.reduce((s, t) => s + t.tiles.length, 0);

  const stats = [
    { label: 'Live templates', value: templates.length, tone: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Tasks', value: totalTasks, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Categories', value: allCats.length - 1, tone: 'text-sky-600 dark:text-sky-400' },
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
    <div className="mx-auto max-w-7xl space-y-6 p-2 pb-12">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Templates</p>
            <h2 className="mt-2 text-2xl font-bold">Ready-made workflows for every team</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Showing {processedTemplates.length} of {templates.length} templates</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <input value={query} onChange={e => {setQuery(e.target.value); setCurrentPage(1);}} placeholder="Search templates..." className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white w-full sm:w-56" />
            <select value={cat} onChange={e => {setCat(e.target.value); setCurrentPage(1);}} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white">
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e => {setSortBy(e.target.value); setCurrentPage(1);}} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white">
              <option value="default">Sort by</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
              <option value="tasks-high">Most Tasks</option>
              <option value="tasks-low">Fewest Tasks</option>
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

      {processedTemplates.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center shadow-sm ${bgCard}`}>
          <p className="text-gray-500 dark:text-gray-400">No templates found matching your criteria.</p>
          <button onClick={() => {setQuery(''); setCat('All'); setSortBy('default');}} className="mt-4 text-indigo-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            {currentTemplates.map((template) => (
              <div key={template.name} className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm ${bgCard}`}>
                <div>
                  <div className={`mb-4 h-28 rounded-2xl bg-gradient-to-br ${template.accent} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-white/20 px-2 py-1 text-xs font-bold uppercase tracking-[0.2em]">{template.category}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.2em]">{template.tiles.length} tasks</span>
                    </div>
                    <h3 className="mt-8 text-xl font-black truncate">{template.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{template.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.tiles.map((tile) => (
                      <span key={tile} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">{tile}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{template.category} • {template.tiles.length} tasks</span>
                  <button type="button" onClick={() => handleUseTemplate(template)} disabled={creating === template.name} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                    {creating === template.name ? 'Creating...' : 'Use template'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-between rounded-2xl border p-4 shadow-sm ${bgCard}`}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800">Previous</button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}