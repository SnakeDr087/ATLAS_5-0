-- ============================================================================
-- ATLAS 5 — seed.sql
-- Run AFTER schema.sql, in the Supabase SQL editor (runs as service role, so
-- RLS does not block these inserts).
--
-- Test accounts (password for ALL: Atlas!2026):
--   superadmin@atlas.app   super_admin      (agency_id = NULL by design)
--   chief@anytownpd.gov    chief            Anytown PD
--   ia@anytownpd.gov       internal_affairs Anytown PD
--   training@anytownpd.gov training_bureau  Anytown PD
--   admin@anytownpd.gov    agency_admin     Anytown PD
--   supervisor@anytownpd.gov supervisor     Anytown PD (10-officer roster)
--
-- If your Supabase project rejects direct auth.users inserts, create these six
-- users in Dashboard → Authentication instead, then UPDATE the profile ids
-- below to match (profiles.id MUST equal auth.users.id).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) GLOBAL BASELINE CONTENT (agency_id = NULL, owned by super_admin)
-- ---------------------------------------------------------------------------

-- 16 baseline incident types
insert into incident_types (id, agency_id, name, is_global_default, sort_order) values
  ('10000000-0000-0000-0000-000000000001', null, 'Traffic Stop',            true, 1),
  ('10000000-0000-0000-0000-000000000002', null, 'Domestic Violence',       true, 2),
  ('10000000-0000-0000-0000-000000000003', null, 'Use of Force',            true, 3),
  ('10000000-0000-0000-0000-000000000004', null, 'DUI Investigation',       true, 4),
  ('10000000-0000-0000-0000-000000000005', null, 'Mental Health Crisis',    true, 5),
  ('10000000-0000-0000-0000-000000000006', null, 'Foot Pursuit',            true, 6),
  ('10000000-0000-0000-0000-000000000007', null, 'Vehicle Pursuit',         true, 7),
  ('10000000-0000-0000-0000-000000000008', null, 'Search Warrant Service',  true, 8),
  ('10000000-0000-0000-0000-000000000009', null, 'Arrest',                  true, 9),
  ('10000000-0000-0000-0000-00000000000a', null, 'Field Interview',         true, 10),
  ('10000000-0000-0000-0000-00000000000b', null, 'Burglary Response',       true, 11),
  ('10000000-0000-0000-0000-00000000000c', null, 'Robbery Response',        true, 12),
  ('10000000-0000-0000-0000-00000000000d', null, 'Crash Investigation',     true, 13),
  ('10000000-0000-0000-0000-00000000000e', null, 'Disturbance / Disorderly',true, 14),
  ('10000000-0000-0000-0000-00000000000f', null, 'Juvenile Contact',        true, 15),
  ('10000000-0000-0000-0000-000000000010', null, 'K-9 Deployment',          true, 16);

-- KPI sets per incident type (baseline: agency_id NULL)
insert into kpi_definitions (incident_type_id, agency_id, kpi_text, sort_order) values
-- Traffic Stop
('10000000-0000-0000-0000-000000000001',null,'Notified dispatch of stop location, plate, and occupant count',1),
('10000000-0000-0000-0000-000000000001',null,'Positioned vehicle for a safety offset and approach cover',2),
('10000000-0000-0000-0000-000000000001',null,'Stated name, agency, and reason for the stop',3),
('10000000-0000-0000-0000-000000000001',null,'Requested license, registration, and insurance professionally',4),
('10000000-0000-0000-0000-000000000001',null,'Maintained visual on occupants and hands throughout contact',5),
('10000000-0000-0000-0000-000000000001',null,'Ran subject and vehicle through dispatch or MDT before release',6),
('10000000-0000-0000-0000-000000000001',null,'Explained enforcement decision (citation/warning) clearly',7),
('10000000-0000-0000-0000-000000000001',null,'Concluded the stop and cleared with dispatch',8),
-- Domestic Violence
('10000000-0000-0000-0000-000000000002',null,'Coordinated arrival with backup before contact',1),
('10000000-0000-0000-0000-000000000002',null,'Separated parties before interviewing',2),
('10000000-0000-0000-0000-000000000002',null,'Interviewed parties independently and documented statements',3),
('10000000-0000-0000-0000-000000000002',null,'Checked for and documented visible injuries',4),
('10000000-0000-0000-0000-000000000002',null,'Identified and interviewed children or witnesses present',5),
('10000000-0000-0000-0000-000000000002',null,'Determined predominant aggressor per policy',6),
('10000000-0000-0000-0000-000000000002',null,'Queried protective orders and firearm restrictions',7),
('10000000-0000-0000-0000-000000000002',null,'Provided victim rights information and resources',8),
('10000000-0000-0000-0000-000000000002',null,'Completed lethality assessment where required',9),
-- Use of Force
('10000000-0000-0000-0000-000000000003',null,'Issued verbal commands and warnings prior to force where feasible',1),
('10000000-0000-0000-0000-000000000003',null,'Attempted de-escalation before escalating force',2),
('10000000-0000-0000-0000-000000000003',null,'Force applied was proportional to resistance encountered',3),
('10000000-0000-0000-0000-000000000003',null,'Ceased force when resistance stopped',4),
('10000000-0000-0000-0000-000000000003',null,'Positioned subject to protect airway after restraint',5),
('10000000-0000-0000-0000-000000000003',null,'Rendered or summoned medical aid promptly',6),
('10000000-0000-0000-0000-000000000003',null,'Notified supervisor per policy',7),
('10000000-0000-0000-0000-000000000003',null,'Camera activated for entirety of the force event',8),
-- DUI Investigation
('10000000-0000-0000-0000-000000000004',null,'Articulated driving behavior establishing reasonable suspicion',1),
('10000000-0000-0000-0000-000000000004',null,'Observed and narrated signs of impairment on contact',2),
('10000000-0000-0000-0000-000000000004',null,'Administered SFSTs per NHTSA standards',3),
('10000000-0000-0000-0000-000000000004',null,'Instructed each test clearly and demonstrated where required',4),
('10000000-0000-0000-0000-000000000004',null,'Conducted preliminary breath test per policy',5),
('10000000-0000-0000-0000-000000000004',null,'Read implied consent advisement verbatim',6),
('10000000-0000-0000-0000-000000000004',null,'Secured and searched vehicle per tow policy',7),
('10000000-0000-0000-0000-000000000004',null,'Observed subject continuously prior to evidentiary test',8),
-- Mental Health Crisis
('10000000-0000-0000-0000-000000000005',null,'Slowed the encounter — used time and distance',1),
('10000000-0000-0000-0000-000000000005',null,'Used calm tone and active listening',2),
('10000000-0000-0000-0000-000000000005',null,'Asked about medications, diagnoses, or treatment providers',3),
('10000000-0000-0000-0000-000000000005',null,'Requested CIT or co-responder resources where available',4),
('10000000-0000-0000-0000-000000000005',null,'Avoided unnecessary commands or crowding',5),
('10000000-0000-0000-0000-000000000005',null,'Evaluated statutory hold criteria and documented basis',6),
('10000000-0000-0000-0000-000000000005',null,'Arranged transport to appropriate facility',7),
('10000000-0000-0000-0000-000000000005',null,'Notified family or caregiver where appropriate',8),
-- Foot Pursuit
('10000000-0000-0000-0000-000000000006',null,'Broadcast direction of travel, description, and reason',1),
('10000000-0000-0000-0000-000000000006',null,'Maintained radio updates during pursuit',2),
('10000000-0000-0000-0000-000000000006',null,'Weighed pursuit risk vs. offense severity',3),
('10000000-0000-0000-0000-000000000006',null,'Avoided splitting from partner without coordination',4),
('10000000-0000-0000-0000-000000000006',null,'Set or requested containment perimeter',5),
('10000000-0000-0000-0000-000000000006',null,'Used cover and slowed at corners/blind spots',6),
('10000000-0000-0000-0000-000000000006',null,'Controlled breathing and commands at apprehension',7),
('10000000-0000-0000-0000-000000000006',null,'Searched subject and area for discarded evidence',8),
-- Vehicle Pursuit
('10000000-0000-0000-0000-000000000007',null,'Initiated pursuit within policy criteria',1),
('10000000-0000-0000-0000-000000000007',null,'Broadcast location, speed, traffic, and reason continuously',2),
('10000000-0000-0000-0000-000000000007',null,'Obtained supervisor authorization to continue',3),
('10000000-0000-0000-0000-000000000007',null,'Maintained safe following distance and speed for conditions',4),
('10000000-0000-0000-0000-000000000007',null,'Deferred to primary/secondary unit assignments',5),
('10000000-0000-0000-0000-000000000007',null,'Evaluated termination criteria as risk changed',6),
('10000000-0000-0000-0000-000000000007',null,'Executed approved intervention technique only when authorized',7),
('10000000-0000-0000-0000-000000000007',null,'Conducted felony/high-risk stop at conclusion',8),
-- Search Warrant Service
('10000000-0000-0000-0000-000000000008',null,'Conducted pre-service briefing with assignments',1),
('10000000-0000-0000-0000-000000000008',null,'Verified correct address and warrant validity before entry',2),
('10000000-0000-0000-0000-000000000008',null,'Executed knock-and-announce per warrant terms',3),
('10000000-0000-0000-0000-000000000008',null,'Secured and accounted for all occupants',4),
('10000000-0000-0000-0000-000000000008',null,'Searched within the scope described in the warrant',5),
('10000000-0000-0000-0000-000000000008',null,'Photographed and logged evidence with chain of custody',6),
('10000000-0000-0000-0000-000000000008',null,'Left copy of warrant and receipt for seized property',7),
('10000000-0000-0000-0000-000000000008',null,'Documented any damage and secured the premises',8),
-- Arrest
('10000000-0000-0000-0000-000000000009',null,'Articulated probable cause prior to arrest',1),
('10000000-0000-0000-0000-000000000009',null,'Announced arrest and gave clear commands',2),
('10000000-0000-0000-0000-000000000009',null,'Applied restraints properly and checked fit',3),
('10000000-0000-0000-0000-000000000009',null,'Conducted thorough search incident to arrest',4),
('10000000-0000-0000-0000-000000000009',null,'Advised Miranda before custodial questioning',5),
('10000000-0000-0000-0000-000000000009',null,'Seat-belted and monitored subject during transport',6),
('10000000-0000-0000-0000-000000000009',null,'Documented property and evidence correctly',7),
('10000000-0000-0000-0000-000000000009',null,'Treated subject with professional demeanor throughout',8),
-- Field Interview
('10000000-0000-0000-0000-00000000000a',null,'Articulated lawful basis for the contact',1),
('10000000-0000-0000-0000-00000000000a',null,'Identified self and explained purpose of contact',2),
('10000000-0000-0000-0000-00000000000a',null,'Distinguished consensual contact from detention correctly',3),
('10000000-0000-0000-0000-00000000000a',null,'Pat-down conducted only with articulable justification',4),
('10000000-0000-0000-0000-00000000000a',null,'Kept contact duration reasonable to its purpose',5),
('10000000-0000-0000-0000-00000000000a',null,'Documented contact per field interview policy',6),
('10000000-0000-0000-0000-00000000000a',null,'Maintained professional tone throughout',7),
('10000000-0000-0000-0000-00000000000a',null,'Concluded contact clearly (free to leave / next steps)',8),
-- Burglary Response
('10000000-0000-0000-0000-00000000000b',null,'Approached without lights/siren where tactically sound',1),
('10000000-0000-0000-0000-00000000000b',null,'Coordinated perimeter with responding units',2),
('10000000-0000-0000-0000-00000000000b',null,'Cleared structure methodically with cover/contact roles',3),
('10000000-0000-0000-0000-00000000000b',null,'Protected the scene from contamination',4),
('10000000-0000-0000-0000-00000000000b',null,'Identified point of entry and documented it',5),
('10000000-0000-0000-0000-00000000000b',null,'Canvassed for witnesses and cameras',6),
('10000000-0000-0000-0000-00000000000b',null,'Requested crime scene processing where warranted',7),
('10000000-0000-0000-0000-00000000000b',null,'Provided victim with case number and follow-up info',8),
-- Robbery Response
('10000000-0000-0000-0000-00000000000c',null,'Obtained and broadcast suspect/vehicle description promptly',1),
('10000000-0000-0000-0000-00000000000c',null,'Approached scene with tactical awareness',2),
('10000000-0000-0000-0000-00000000000c',null,'Rendered aid to injured parties',3),
('10000000-0000-0000-0000-00000000000c',null,'Separated witnesses and obtained statements',4),
('10000000-0000-0000-0000-00000000000c',null,'Secured scene and preserved evidence',5),
('10000000-0000-0000-0000-00000000000c',null,'Coordinated area check / K-9 / air support as available',6),
('10000000-0000-0000-0000-00000000000c',null,'Collected video evidence or documented its existence',7),
('10000000-0000-0000-0000-00000000000c',null,'Conducted show-up identification per policy if applicable',8),
-- Crash Investigation
('10000000-0000-0000-0000-00000000000d',null,'Positioned vehicle to protect the scene',1),
('10000000-0000-0000-0000-00000000000d',null,'Checked all parties for injuries and summoned EMS as needed',2),
('10000000-0000-0000-0000-00000000000d',null,'Established traffic control / requested assistance',3),
('10000000-0000-0000-0000-00000000000d',null,'Exchanged and verified driver information and documents',4),
('10000000-0000-0000-0000-00000000000d',null,'Photographed vehicles, damage, and roadway evidence',5),
('10000000-0000-0000-0000-00000000000d',null,'Interviewed drivers and witnesses separately',6),
('10000000-0000-0000-0000-00000000000d',null,'Evaluated impairment indicators for all drivers',7),
('10000000-0000-0000-0000-00000000000d',null,'Cleared roadway and completed report requirements',8),
-- Disturbance / Disorderly
('10000000-0000-0000-0000-00000000000e',null,'Gathered information from dispatch before arrival',1),
('10000000-0000-0000-0000-00000000000e',null,'Assessed scene before committing to contact',2),
('10000000-0000-0000-0000-00000000000e',null,'Separated involved parties',3),
('10000000-0000-0000-0000-00000000000e',null,'Used de-escalation language and posture',4),
('10000000-0000-0000-0000-00000000000e',null,'Identified all parties and checked for warrants',5),
('10000000-0000-0000-0000-00000000000e',null,'Determined whether a crime occurred and acted accordingly',6),
('10000000-0000-0000-0000-00000000000e',null,'Offered resolution options short of arrest where lawful',7),
('10000000-0000-0000-0000-00000000000e',null,'Documented disposition and any warnings issued',8),
-- Juvenile Contact
('10000000-0000-0000-0000-00000000000f',null,'Used age-appropriate communication',1),
('10000000-0000-0000-0000-00000000000f',null,'Notified parent/guardian per statute and policy',2),
('10000000-0000-0000-0000-00000000000f',null,'Applied juvenile Miranda / interested-adult rules correctly',3),
('10000000-0000-0000-0000-00000000000f',null,'Considered diversion options before custody',4),
('10000000-0000-0000-0000-00000000000f',null,'Kept juvenile separated from adult detainees',5),
('10000000-0000-0000-0000-00000000000f',null,'Documented contact per juvenile records requirements',6),
('10000000-0000-0000-0000-00000000000f',null,'Coordinated with school/juvenile services where applicable',7),
('10000000-0000-0000-0000-00000000000f',null,'Released only to authorized adult with documentation',8),
-- K-9 Deployment
('10000000-0000-0000-0000-000000000010',null,'Deployment met policy criteria for offense severity',1),
('10000000-0000-0000-0000-000000000010',null,'Gave loud, repeated K-9 warnings before release',2),
('10000000-0000-0000-0000-000000000010',null,'Allowed reasonable surrender time after warning',3),
('10000000-0000-0000-0000-000000000010',null,'Maintained control of the K-9 throughout deployment',4),
('10000000-0000-0000-0000-000000000010',null,'Called the K-9 off promptly upon compliance',5),
('10000000-0000-0000-0000-000000000010',null,'Photographed and documented any bite injuries',6),
('10000000-0000-0000-0000-000000000010',null,'Summoned medical evaluation for any contact',7),
('10000000-0000-0000-0000-000000000010',null,'Completed use-of-force and K-9 deployment reports',8);

-- Universal Performance Assessment set (incident_type_id NULL, single-select on every review)
insert into kpi_definitions (id, incident_type_id, agency_id, kpi_text, sort_order) values
('20000000-0000-0000-0000-000000000001',null,null,'Exceeds standards — model performance suitable for training example',1),
('20000000-0000-0000-0000-000000000002',null,null,'Meets standards — competent, policy-compliant performance',2),
('20000000-0000-0000-0000-000000000003',null,null,'Meets standards with minor deficiencies noted',3),
('20000000-0000-0000-0000-000000000004',null,null,'Below standards — correctable deficiencies requiring follow-up',4),
('20000000-0000-0000-0000-000000000005',null,null,'Substantially below standards — formal intervention required',5);

-- Officer safety deficiency checklist baseline
insert into safety_checklist_items (agency_id, item_text, sort_order) values
(null,'Failed to maintain reactionary gap',1),
(null,'Turned back on unsecured subject',2),
(null,'Weapon retention lapse (holster unsecured / weapon side exposed)',3),
(null,'Stood in traffic lane or unsafe roadway position',4),
(null,'Failed to search subject before transport',5),
(null,'Handcuffing technique deficiency (single cuff, no double-lock, fit unchecked)',6),
(null,'Tunnel vision — lost awareness of secondary subjects or surroundings',7),
(null,'Entered structure/vehicle without cover officer when required',8),
(null,'Crossed a partner''s line of fire',9),
(null,'Radio discipline lapse (location/status not updated)',10),
(null,'BWC not activated or deactivated prematurely',11),
(null,'Improper approach to vehicle (blind spot / contact side error)',12);

-- Disposition baseline (stable codes, DB-driven)
insert into disposition_types (agency_id, code, label, sort_order) values
(null,'arrest_made','Arrest Made',1),
(null,'citation_issued','Citation Issued',2),
(null,'verbal_warning','Verbal Warning',3),
(null,'written_warning','Written Warning',4),
(null,'field_release','Field Release',5),
(null,'report_filed','Report Filed',6),
(null,'citizen_assist','Citizen Assist',7),
(null,'transported_medical','Transported — Medical',8),
(null,'referred_other_agency','Referred to Other Agency',9),
(null,'no_action_taken','No Action Taken',10),
(null,'other','Other (see notes)',11);

-- ---------------------------------------------------------------------------
-- 2) SAMPLE AGENCY: ANYTOWN PD
-- ---------------------------------------------------------------------------
insert into agencies (id, name, state, address, city, zip, phone, head_name, head_title,
                      head_email, agency_size, review_frequency, min_performance_threshold)
values ('a0000000-0000-0000-0000-000000000001','Anytown Police Department','NJ',
        '100 Justice Way','Anytown','07001','(908) 555-0100',
        'Robert T. Callahan','Chief of Police','chief@anytownpd.gov',
        '50-100 sworn','monthly',80);

insert into same_rank_permissions (agency_id, allow_same_rank) values
('a0000000-0000-0000-0000-000000000001', true);

-- Rank structure
insert into agency_ranks (id, agency_id, rank_name, rank_order) values
('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Officer',1),
('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Corporal',2),
('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Sergeant',3),
('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Lieutenant',4),
('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Captain',5),
('b0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Chief',6);

-- 20-officer roster
insert into personnel_roster (id, agency_id, first_name, last_name, badge_number, email, rank_id, officer_status) values
('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Marcus','Webb','1041','mwebb@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Dana','Reyes','1042','dreyes@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Trevor','Nash','1043','tnash@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Priya','Kaur','1044','pkaur@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Luis','Ferrara','1045','lferrara@anytownpd.gov','b0000000-0000-0000-0000-000000000002','active'),
('c0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Aisha','Okafor','1046','aokafor@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Colin','Brandt','1047','cbrandt@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','Renee','Duval','1048','rduval@anytownpd.gov','b0000000-0000-0000-0000-000000000002','active'),
('c0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001','Victor','Slate','1049','vslate@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-00000000000a','a0000000-0000-0000-0000-000000000001','Hannah','Voss','1050','hvoss@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-00000000000b','a0000000-0000-0000-0000-000000000001','Devon','Pratt','1051','dpratt@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-00000000000c','a0000000-0000-0000-0000-000000000001','Sofia','Marchetti','1052','smarchetti@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-00000000000d','a0000000-0000-0000-0000-000000000001','Gregor','Lindqvist','1053','glindqvist@anytownpd.gov','b0000000-0000-0000-0000-000000000002','active'),
('c0000000-0000-0000-0000-00000000000e','a0000000-0000-0000-0000-000000000001','Tanya','Boone','1054','tboone@anytownpd.gov','b0000000-0000-0000-0000-000000000001','on_leave'),
('c0000000-0000-0000-0000-00000000000f','a0000000-0000-0000-0000-000000000001','Omar','Haddad','1055','ohaddad@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','Celeste','Rowan','1056','crowan@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000011','a0000000-0000-0000-0000-000000000001','Jared','Whitfield','1057','jwhitfield@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000012','a0000000-0000-0000-0000-000000000001','Mina','Castellanos','1058','mcastellanos@anytownpd.gov','b0000000-0000-0000-0000-000000000001','active'),
('c0000000-0000-0000-0000-000000000013','a0000000-0000-0000-0000-000000000001','Errol','Quinlan','1059','equinlan@anytownpd.gov','b0000000-0000-0000-0000-000000000001','inactive'),
('c0000000-0000-0000-0000-000000000014','a0000000-0000-0000-0000-000000000001','Beatrix','Halvorsen','1060','bhalvorsen@anytownpd.gov','b0000000-0000-0000-0000-000000000002','active');

-- ---------------------------------------------------------------------------
-- 3) TEST ACCOUNTS — one per role. Password for all: Atlas!2026
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       u.email, crypt('Atlas!2026', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-0000-0000-000000000001'::uuid,'superadmin@atlas.app'),
  ('d0000000-0000-0000-0000-000000000002'::uuid,'chief@anytownpd.gov'),
  ('d0000000-0000-0000-0000-000000000003'::uuid,'ia@anytownpd.gov'),
  ('d0000000-0000-0000-0000-000000000004'::uuid,'training@anytownpd.gov'),
  ('d0000000-0000-0000-0000-000000000005'::uuid,'admin@anytownpd.gov'),
  ('d0000000-0000-0000-0000-000000000006'::uuid,'supervisor@anytownpd.gov')
) as u(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
               'd0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004',
               'd0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000006');

-- Profiles: id MUST equal auth.users.id. super_admin agency_id is NULL by design.
insert into profiles (id, agency_id, role, full_name, email, rank_id) values
('d0000000-0000-0000-0000-000000000001', null, 'super_admin','Jonathan Parham','superadmin@atlas.app', null),
('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','chief','Robert T. Callahan','chief@anytownpd.gov','b0000000-0000-0000-0000-000000000006'),
('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','internal_affairs','Lt. Simone Ashford','ia@anytownpd.gov','b0000000-0000-0000-0000-000000000004'),
('d0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','training_bureau','Sgt. Paul Okonkwo','training@anytownpd.gov','b0000000-0000-0000-0000-000000000003'),
('d0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','agency_admin','Karen Molloy','admin@anytownpd.gov', null),
('d0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','supervisor','Sgt. David Marsh','supervisor@anytownpd.gov','b0000000-0000-0000-0000-000000000003');

-- Supervisor's roster: 10 of the 20 officers
insert into supervisor_rosters (supervisor_id, officer_id) values
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000003'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000004'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000005'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000006'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000007'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000008'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000009'),
('d0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-00000000000a');

-- ============================================================================
-- END seed.sql
-- ============================================================================
