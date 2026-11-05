import React from 'react';
import { View } from 'react-native';
import Svg, {
  G,
  Path,
  Circle,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import type { WorkerIllustrationProps, IllustrationName } from './types';

// Color Palette for Consistent Worker Character Design
const COLORS = {
  skin: '#C28867',
  skinDark: '#9E6446',
  helmet: '#F59E0B',
  helmetShade: '#D97706',
  hair: '#292524',
  vestTeal: '#0D9488',
  vestNavy: '#0F766E',
  vestOrange: '#EA580C',
  stripes: '#FEF08A',
  bgSoftTeal: '#F0FDFA',
  bgSoftBlue: '#EFF6FF',
  bgSoftGreen: '#F0FDF4',
  bgSoftOrange: '#FFF7ED',
  phoneBody: '#1E293B',
  phoneScreen: '#38BDF8',
  successGreen: '#16A34A',
  alertRed: '#DC2626',
  white: '#FFFFFF',
};

export function WorkerIllustration({
  name,
  width = 160,
  height = 160,
  style,
  testID,
}: WorkerIllustrationProps) {
  const renderScene = (type: IllustrationName) => {
    switch (type) {
      // 1. Worker Holding Phone
      case 'worker_holding_phone':
        return (
          <G>
            {/* Background Aura */}
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            {/* Body */}
            <Path d="M40 145 C40 115 55 105 80 105 C105 105 120 115 120 145 Z" fill={COLORS.vestTeal} />
            <Path d="M60 105 L60 145 M100 105 L100 145" stroke={COLORS.stripes} strokeWidth="5" />
            {/* Head & Neck */}
            <Rect x="72" y="85" width="16" height="22" rx="4" fill={COLORS.skinDark} />
            <Circle cx="80" cy="68" r="22" fill={COLORS.skin} />
            {/* Hair */}
            <Path d="M58 66 C58 50 68 45 80 45 C92 45 102 50 102 66" fill={COLORS.hair} />
            {/* Safety Helmet */}
            <Path d="M55 52 C55 35 66 26 80 26 C94 26 105 35 105 52 Z" fill={COLORS.helmet} />
            <Rect x="50" y="50" width="60" height="7" rx="3.5" fill={COLORS.helmetShade} />
            {/* Facial Features */}
            <Circle cx="73" cy="65" r="2.5" fill="#1E293B" />
            <Circle cx="87" cy="65" r="2.5" fill="#1E293B" />
            <Path d="M74 74 Q80 78 86 74" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Arms & Phone */}
            <Path d="M45 125 L70 120 L80 115" stroke={COLORS.skin} strokeWidth="10" strokeLinecap="round" />
            <Path d="M115 125 L95 120" stroke={COLORS.skin} strokeWidth="10" strokeLinecap="round" />
            {/* Smartphone */}
            <Rect x="82" y="95" width="28" height="46" rx="6" fill={COLORS.phoneBody} />
            <Rect x="85" y="99" width="22" height="38" rx="3" fill={COLORS.phoneScreen} />
            <Circle cx="96" cy="118" r="6" fill={COLORS.white} />
          </G>
        );

      // 2. Worker Selecting Language
      case 'worker_selecting_language':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftBlue} />
            {/* Worker Avatar on left */}
            <Path d="M20 150 C20 125 35 115 55 115 C75 115 85 125 85 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="52" cy="82" r="18" fill={COLORS.skin} />
            <Path d="M33 70 C33 55 42 46 52 46 C62 46 71 55 71 70 Z" fill={COLORS.helmet} />
            <Rect x="28" y="68" width="48" height="6" rx="3" fill={COLORS.helmetShade} />
            {/* Arm pointing to languages */}
            <Path d="M65 125 L95 105" stroke={COLORS.skin} strokeWidth="8" strokeLinecap="round" />
            {/* Language Speech Cards */}
            <Rect x="92" y="32" width="52" height="30" rx="8" fill={COLORS.white} stroke="#3B82F6" strokeWidth="2" />
            <Path d="M104 53 L108 41 L112 53 M105 50 L111 50" stroke="#1E40AF" strokeWidth="2" strokeLinecap="round" />
            <Rect x="102" y="72" width="52" height="30" rx="8" fill={COLORS.white} stroke="#10B981" strokeWidth="2" />
            <Path d="M116 80 L128 80 M122 80 L122 94 M116 86 C119 86 122 87 122 89 C122 91 119 92 116 92" stroke="#047857" strokeWidth="2" strokeLinecap="round" fill="none" />
            <Rect x="92" y="112" width="52" height="30" rx="8" fill={COLORS.white} stroke="#F59E0B" strokeWidth="2" />
            <Circle cx="118" cy="127" r="8" fill="#FDE68A" />
            <Path d="M115 127 L121 127" stroke="#B45309" strokeWidth="2" />
          </G>
        );

      // 3. Worker Giving Consent
      case 'worker_giving_consent':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftGreen} />
            {/* Clipboard with Consent Document */}
            <Rect x="42" y="28" width="76" height="104" rx="8" fill={COLORS.white} stroke="#059669" strokeWidth="2" />
            <Rect x="60" y="22" width="40" height="12" rx="4" fill="#94A3B8" />
            {/* Document Lines */}
            <Rect x="54" y="48" width="52" height="4" rx="2" fill="#CBD5E1" />
            <Rect x="54" y="58" width="44" height="4" rx="2" fill="#CBD5E1" />
            <Rect x="54" y="68" width="48" height="4" rx="2" fill="#CBD5E1" />
            {/* Big Green Stamp of Acceptance */}
            <Circle cx="80" cy="98" r="22" fill={COLORS.successGreen} />
            <Path d="M71 98 L77 104 L90 91" stroke={COLORS.white} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Hand stamping */}
            <Path d="M96 130 L88 112" stroke={COLORS.skin} strokeWidth="9" strokeLinecap="round" />
          </G>
        );

      // 4. Worker Completing Registration
      case 'worker_completing_registration':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            {/* Identity Pass Card */}
            <Rect x="30" y="45" width="100" height="70" rx="8" fill={COLORS.white} stroke={COLORS.vestTeal} strokeWidth="3" />
            <Rect x="38" y="55" width="28" height="32" rx="4" fill="#E2E8F0" />
            <Circle cx="52" cy="67" r="8" fill={COLORS.skin} />
            <Path d="M42 85 C42 77 47 75 52 75 C57 75 62 77 62 85" fill={COLORS.vestTeal} />
            {/* ID Info Lines */}
            <Rect x="74" y="58" width="46" height="5" rx="2.5" fill="#334155" />
            <Rect x="74" y="69" width="36" height="4" rx="2" fill="#94A3B8" />
            <Rect x="74" y="78" width="42" height="4" rx="2" fill="#94A3B8" />
            {/* Green Verified Checkmark */}
            <Circle cx="120" cy="110" r="16" fill={COLORS.successGreen} />
            <Path d="M113 110 L118 115 L128 105" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" fill="none" />
          </G>
        );

      // 5. Worker Answering Health Questions
      case 'worker_answering_health_questions':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftBlue} />
            {/* Worker Head */}
            <Circle cx="60" cy="75" r="20" fill={COLORS.skin} />
            <Path d="M38 60 C38 46 48 38 60 38 C72 38 82 46 82 60 Z" fill={COLORS.helmet} />
            <Rect x="34" y="58" width="52" height="6" rx="3" fill={COLORS.helmetShade} />
            <Path d="M26 145 C26 120 40 110 60 110 C80 110 94 120 94 145 Z" fill={COLORS.vestTeal} />
            {/* Thermometer / Health Vitals */}
            <G transform="translate(95, 35)">
              <Rect x="16" y="8" width="10" height="40" rx="5" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
              <Circle cx="21" cy="46" r="9" fill={COLORS.alertRed} />
              <Rect x="18" y="24" width="6" height="24" rx="3" fill={COLORS.alertRed} />
            </G>
            {/* Big YES / NO Options */}
            <Rect x="90" y="88" width="34" height="24" rx="6" fill="#DCFCE7" stroke="#16A34A" strokeWidth="2" />
            <Path d="M98 100 L103 105 L116 95" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" fill="none" />
            <Rect x="90" y="118" width="34" height="24" rx="6" fill="#FEE2E2" stroke="#DC2626" strokeWidth="2" />
            <Path d="M100 124 L114 136 M114 124 L100 136" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
          </G>
        );

      // 6. Health Worker Helping a Worker Complete Screening
      case 'health_worker_helping_screening':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            {/* Worker on Left */}
            <Path d="M15 145 C15 125 25 115 45 115 C60 115 65 125 65 145 Z" fill={COLORS.vestTeal} />
            <Circle cx="40" cy="80" r="16" fill={COLORS.skin} />
            <Path d="M22 68 C22 55 30 48 40 48 C50 48 58 55 58 68 Z" fill={COLORS.helmet} />
            {/* Health Worker in Apron/White Coat on Right */}
            <Path d="M95 145 C95 122 105 112 125 112 C145 112 155 122 155 145 Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1.5" />
            <Circle cx="125" cy="76" r="16" fill={COLORS.skin} />
            {/* Stethoscope */}
            <Path d="M117 90 C117 106 133 106 133 90" stroke="#0284C7" strokeWidth="2.5" fill="none" />
            <Circle cx="125" cy="106" r="4" fill="#0284C7" />
            {/* Tablet between them */}
            <Rect x="65" y="90" width="36" height="48" rx="5" fill="#1E293B" stroke="#0D9488" strokeWidth="2" />
            <Rect x="69" y="94" width="28" height="40" rx="3" fill="#38BDF8" />
            <Path d="M74 105 L80 111 L90 101" stroke={COLORS.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </G>
        );

      // 7. Worker Adding Family Member
      case 'worker_adding_family_member':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftOrange} />
            {/* Father (Worker) */}
            <Path d="M20 150 C20 125 32 116 50 116 C68 116 75 125 75 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="48" cy="84" r="16" fill={COLORS.skin} />
            <Path d="M30 72 C30 60 38 52 48 52 C58 52 66 60 66 72 Z" fill={COLORS.helmet} />
            {/* Mother (Spouse) */}
            <Path d="M85 150 C85 128 95 118 114 118 C133 118 143 128 143 150 Z" fill="#E11D48" />
            <Circle cx="114" cy="88" r="15" fill={COLORS.skin} />
            <Path d="M96 82 C96 68 104 62 114 62 C124 62 132 68 132 82 Z" fill={COLORS.hair} />
            {/* Child */}
            <Path d="M62 150 C62 136 68 130 80 130 C92 130 98 136 98 150 Z" fill="#F59E0B" />
            <Circle cx="80" cy="114" r="11" fill={COLORS.skin} />
            {/* Plus badge */}
            <Circle cx="132" cy="42" r="14" fill={COLORS.successGreen} />
            <Path d="M125 42 L139 42 M132 35 L132 49" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" />
          </G>
        );

      // 8. Worker Adding Roommate
      case 'worker_adding_roommate':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftBlue} />
            {/* Worker 1 */}
            <Path d="M25 150 C25 125 38 116 55 116 C72 116 80 125 80 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="52" cy="82" r="16" fill={COLORS.skin} />
            <Path d="M34 70 C34 58 42 50 52 50 C62 50 70 58 70 70 Z" fill={COLORS.helmet} />
            {/* Worker 2 (Roommate) */}
            <Path d="M80 150 C80 125 92 116 110 116 C128 116 138 125 138 150 Z" fill="#0284C7" />
            <Circle cx="110" cy="82" r="16" fill={COLORS.skin} />
            <Path d="M92 70 C92 58 100 50 110 50 C120 50 128 58 128 70 Z" fill="#F97316" />
            {/* Shared Camp / Accommodation Icon Above */}
            <Path d="M80 25 L104 42 L56 42 Z" fill="#475569" />
            <Rect x="64" y="42" width="32" height="20" fill="#E2E8F0" />
            <Rect x="74" y="48" width="12" height="14" fill="#94A3B8" />
          </G>
        );

      // 9. Worker Viewing QR Pass
      case 'worker_viewing_qr_pass':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            {/* Large Glowing Smartphone */}
            <Rect x="44" y="24" width="72" height="114" rx="12" fill={COLORS.phoneBody} stroke="#0D9488" strokeWidth="3" />
            <Rect x="49" y="30" width="62" height="102" rx="8" fill={COLORS.white} />
            {/* QR Code Blocks */}
            <Rect x="58" y="42" width="44" height="44" rx="4" fill="#0F172A" />
            <Rect x="63" y="47" width="12" height="12" fill={COLORS.white} />
            <Rect x="66" y="50" width="6" height="6" fill="#0F172A" />
            <Rect x="85" y="47" width="12" height="12" fill={COLORS.white} />
            <Rect x="88" y="50" width="6" height="6" fill="#0F172A" />
            <Rect x="63" y="69" width="12" height="12" fill={COLORS.white} />
            <Rect x="66" y="72" width="6" height="6" fill="#0F172A" />
            {/* Green Valid Token Pill */}
            <Rect x="56" y="96" width="48" height="14" rx="7" fill="#DCFCE7" />
            <Circle cx="63" cy="103" r="4" fill={COLORS.successGreen} />
            <Rect x="71" y="101" width="26" height="4" rx="2" fill="#16A34A" />
            {/* Hands holding */}
            <Path d="M30 115 L46 100" stroke={COLORS.skin} strokeWidth="10" strokeLinecap="round" />
            <Path d="M130 115 L114 100" stroke={COLORS.skin} strokeWidth="10" strokeLinecap="round" />
          </G>
        );

      // 10. Worker Showing QR to Contractor
      case 'worker_showing_qr_to_contractor':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftBlue} />
            {/* Worker on Left holding out phone */}
            <Path d="M12 150 C12 125 24 116 42 116 C58 116 66 125 66 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="38" cy="80" r="16" fill={COLORS.skin} />
            <Path d="M20 68 C20 56 28 48 38 48 C48 48 56 56 56 68 Z" fill={COLORS.helmet} />
            {/* Phone held out */}
            <Rect x="62" y="76" width="22" height="34" rx="4" fill={COLORS.phoneBody} />
            <Rect x="65" y="80" width="16" height="16" fill="#0F172A" />
            {/* Contractor on Right holding scanner/tablet */}
            <Path d="M94 150 C94 125 106 116 124 116 C142 116 150 125 150 150 Z" fill="#3B82F6" />
            <Circle cx="122" cy="80" r="16" fill={COLORS.skin} />
            <Path d="M104 68 C104 56 112 48 122 48 C132 48 140 56 140 68 Z" fill="#1E293B" />
            {/* Scanning beam */}
            <Path d="M84 86 L102 82 M84 94 L102 96" stroke="#22C55E" strokeWidth="2.5" strokeDasharray="3,3" />
          </G>
        );

      // 11. Worker Leaving Goa
      case 'worker_leaving_goa':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftOrange} />
            {/* Worker with travel bag */}
            <Path d="M35 150 C35 125 50 115 75 115 C95 115 108 125 108 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="72" cy="78" r="18" fill={COLORS.skin} />
            <Path d="M52 64 C52 48 62 40 72 40 C82 40 92 48 92 64 Z" fill={COLORS.helmet} />
            {/* Large Travel Duffel / Luggage on right */}
            <Rect x="104" y="98" width="38" height="48" rx="8" fill="#B45309" stroke="#78350F" strokeWidth="2" />
            <Path d="M116 98 L116 88 L130 88 L130 98" stroke="#78350F" strokeWidth="3" fill="none" />
            {/* Outgoing train / arrow symbol */}
            <Circle cx="125" cy="40" r="16" fill="#F97316" />
            <Path d="M117 40 L131 40 M126 34 L132 40 L126 46" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        );

      // 12. Worker Returning to Goa
      case 'worker_returning_to_goa':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftGreen} />
            {/* Welcome Palm Trees of Goa */}
            <Path d="M26 130 Q32 80 26 50" stroke="#78350F" strokeWidth="5" strokeLinecap="round" fill="none" />
            <Path d="M26 50 C12 40 6 54 4 58 M26 50 C38 40 46 52 48 58 M26 50 C26 30 20 25 18 24" stroke="#15803D" strokeWidth="3" fill="none" />
            {/* Returning Worker */}
            <Path d="M60 150 C60 125 75 115 98 115 C118 115 130 125 130 150 Z" fill={COLORS.vestTeal} />
            <Circle cx="94" cy="78" r="18" fill={COLORS.skin} />
            <Path d="M74 64 C74 48 84 40 94 40 C104 40 114 48 114 64 Z" fill={COLORS.helmet} />
            {/* Health Border Check Shield */}
            <Circle cx="128" cy="40" r="16" fill={COLORS.successGreen} />
            <Path d="M134 40 L122 40 M127 34 L121 40 L127 46" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        );

      // 13. Worker Reporting Fever or Illness
      case 'worker_reporting_fever':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill="#FEF2F2" />
            {/* Unwell Worker with sad face & ice pack on forehead */}
            <Path d="M40 150 C40 125 55 115 80 115 C105 115 120 125 120 150 Z" fill="#94A3B8" />
            <Circle cx="80" cy="78" r="22" fill={COLORS.skin} />
            {/* Ice pack / bandage on head */}
            <Path d="M62 58 C66 48 94 48 98 58" stroke="#38BDF8" strokeWidth="8" strokeLinecap="round" />
            {/* Eyes closed unwell */}
            <Path d="M70 76 L76 78 M84 78 L90 76" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
            {/* Drooping mouth */}
            <Path d="M74 92 Q80 86 86 92" stroke="#475569" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Thermometer with high fever */}
            <G transform="translate(100, 75) rotate(-25)">
              <Rect x="0" y="0" width="8" height="34" rx="4" fill="#E2E8F0" stroke="#64748B" strokeWidth="1" />
              <Circle cx="4" cy="30" r="7" fill={COLORS.alertRed} />
              <Rect x="2" y="10" width="4" height="20" rx="2" fill={COLORS.alertRed} />
            </G>
            {/* Warning triangle */}
            <Path d="M30 46 L44 70 L16 70 Z" fill="#F59E0B" />
            <Path d="M30 55 L30 61 M30 64 L30 66" stroke={COLORS.white} strokeWidth="2" strokeLinecap="round" />
          </G>
        );

      // 14. Worker Recording a Voice Message
      case 'worker_recording_voice':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftBlue} />
            {/* Worker speaking */}
            <Circle cx="56" cy="80" r="18" fill={COLORS.skin} />
            <Path d="M36 66 C36 52 46 44 56 44 C66 44 76 52 76 66 Z" fill={COLORS.helmet} />
            <Path d="M25 150 C25 125 40 115 60 115 C75 115 88 125 88 150 Z" fill={COLORS.vestTeal} />
            {/* Phone with glowing red recording microphone */}
            <Rect x="88" y="70" width="34" height="60" rx="8" fill={COLORS.phoneBody} stroke="#0284C7" strokeWidth="2" />
            <Circle cx="105" cy="95" r="12" fill={COLORS.alertRed} />
            {/* Microphone icon */}
            <Rect x="102" y="89" width="6" height="9" rx="3" fill={COLORS.white} />
            <Path d="M99 94 C99 99 111 99 111 94 M105 99 L105 103" stroke={COLORS.white} strokeWidth="2" fill="none" />
            {/* Audio Wave Arcs */}
            <Path d="M128 85 C134 92 134 102 128 109" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" fill="none" />
            <Path d="M136 78 C144 89 144 105 136 116" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" fill="none" />
          </G>
        );

      // 15. Worker Viewing Completed Submission
      case 'worker_viewing_completed_submission':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftGreen} />
            {/* Large Verified Certificate / Card */}
            <Rect x="35" y="32" width="90" height="100" rx="12" fill={COLORS.white} stroke="#16A34A" strokeWidth="3" />
            <Circle cx="80" cy="65" r="22" fill={COLORS.successGreen} />
            <Path d="M70 65 L77 72 L91 58" stroke={COLORS.white} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Success details lines */}
            <Rect x="50" y="96" width="60" height="6" rx="3" fill="#0F766E" />
            <Rect x="58" y="108" width="44" height="5" rx="2.5" fill="#94A3B8" />
            {/* Stars / Confetti */}
            <Circle cx="30" cy="40" r="4" fill="#F59E0B" />
            <Circle cx="130" cy="45" r="4" fill="#F59E0B" />
            <Circle cx="125" cy="115" r="3" fill="#0D9488" />
          </G>
        );

      // 16. Worker Saving Information Offline
      case 'worker_saving_offline':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftOrange} />
            {/* Smartphone with Offline Database save */}
            <Rect x="44" y="28" width="72" height="110" rx="12" fill={COLORS.phoneBody} stroke="#EA580C" strokeWidth="2.5" />
            <Rect x="50" y="36" width="60" height="94" rx="6" fill="#F8FAFC" />
            {/* Cloud with Slash (No Internet) */}
            <Path d="M64 64 C64 56 70 52 76 52 C82 52 87 56 88 60 C92 60 96 64 96 68 C96 74 92 76 86 76 L66 76 C62 76 58 72 58 68 C58 65 60 64 64 64 Z" fill="#94A3B8" />
            <Path d="M54 50 L104 80" stroke="#DC2626" strokeWidth="3.5" strokeLinecap="round" />
            {/* Local Storage Disk & Checkmark (Safe on Phone) */}
            <Rect x="60" y="90" width="40" height="26" rx="4" fill="#15803D" />
            <Path d="M72 103 L78 108 L88 98" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" fill="none" />
          </G>
        );

      // 17. Worker Reconnecting and Synchronising
      case 'worker_syncing_online':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftGreen} />
            {/* Cloud with Upload Arrow */}
            <Path d="M60 56 C60 46 68 40 78 40 C86 40 93 45 95 52 C101 52 106 57 106 63 C106 70 101 74 94 74 L64 74 C58 74 54 69 54 64 C54 60 57 56 60 56 Z" fill="#0D9488" />
            <Path d="M80 66 L80 48 M74 54 L80 48 L86 54" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Synced Phone */}
            <Rect x="54" y="84" width="52" height="58" rx="8" fill={COLORS.phoneBody} />
            <Rect x="58" y="90" width="44" height="46" rx="4" fill="#DCFCE7" />
            {/* Rotating Sync Arrows */}
            <Circle cx="80" cy="112" r="12" fill={COLORS.successGreen} />
            <Path d="M74 112 L80 106 L86 112" stroke={COLORS.white} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </G>
        );

      // 18. Worker Viewing a Test Result
      case 'worker_viewing_test_result':
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            {/* Diagnostic Test Cassette / Result Strip */}
            <Rect x="36" y="40" width="88" height="80" rx="10" fill={COLORS.white} stroke="#0D9488" strokeWidth="3" />
            {/* RDT Test Window */}
            <Rect x="52" y="55" width="22" height="50" rx="4" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" />
            {/* Control Line (C) & Test Line (T) */}
            <Path d="M56 70 L70 70" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" />
            {/* Verified Medical Shield on right */}
            <Path d="M96 55 L112 60 L112 80 C112 90 96 100 96 100 C96 100 80 90 80 80 L80 60 Z" fill="#10B981" />
            <Path d="M89 77 L94 82 L103 72" stroke={COLORS.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </G>
        );

      default:
        return (
          <G>
            <Circle cx="80" cy="80" r="70" fill={COLORS.bgSoftTeal} />
            <Circle cx="80" cy="80" r="30" fill={COLORS.vestTeal} />
          </G>
        );
    }
  };

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]} testID={testID}>
      <Svg width={width} height={height} viewBox="0 0 160 160">
        <Defs>
          <LinearGradient id="helmetGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.helmet} />
            <Stop offset="1" stopColor={COLORS.helmetShade} />
          </LinearGradient>
        </Defs>
        {renderScene(name)}
      </Svg>
    </View>
  );
}
