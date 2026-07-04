import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Shield, 
  Users, 
  Calendar, 
  Clock, 
  CreditCard, 
  Sparkles, 
  Check, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  HelpCircle, 
  Menu, 
  X, 
  Building, 
  Activity, 
  Plus, 
  Zap, 
  Award, 
  TrendingUp,
  Coins,
  Briefcase,
  Sliders,
  CheckCircle2,
  Lock,
  Globe,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { checkIsNigeriaSync, detectIsNigeria } from '../currency';

interface LandingPageProps {
  onGetStarted: (planName?: string) => void;
  onLoginClick: () => void;
  isLoggedIn: boolean;
  onGoToDashboard: () => void;
}

export default function LandingPage({ onGetStarted, onLoginClick, isLoggedIn, onGoToDashboard }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>(() => checkIsNigeriaSync() ? 'NGN' : 'USD');

  useEffect(() => {
    async function initCurrency() {
      const isNG = await detectIsNigeria();
      setCurrency(isNG ? 'NGN' : 'USD');
    }
    initCurrency();
  }, []);
  
  // Interactive Seat Calculator state
  const [employeeSeats, setEmployeeSeats] = useState(25);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annually'>('annually');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success'>('idle');

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Dynamic plan calculation based on slider
  const calculatePlanDetails = (seats: number) => {
    let plan = 'Starter';
    let basePrice = billingPeriod === 'annually' ? 39 : 49;
    let extraSeatPrice = 0;
    let limitText = 'Up to 15 Employees';

    if (seats <= 15) {
      plan = 'Starter';
      basePrice = billingPeriod === 'annually' ? 39 : 49;
    } else if (seats <= 100) {
      plan = 'Growth';
      basePrice = billingPeriod === 'annually' ? 119 : 149;
      extraSeatPrice = (seats - 15) * (billingPeriod === 'annually' ? 3 : 4);
      limitText = 'Up to 100 Employees';
    } else {
      plan = 'Enterprise';
      basePrice = billingPeriod === 'annually' ? 399 : 499;
      extraSeatPrice = (seats - 100) * (billingPeriod === 'annually' ? 2 : 3);
      limitText = 'Unlimited Employees';
    }

    const totalCostUSD = basePrice + extraSeatPrice;
    // For Nigerian users, convert to Naira using the approximate conversion factor
    const totalCost = currency === 'NGN' ? totalCostUSD * 1500 : totalCostUSD;

    return {
      plan,
      totalCost,
      limitText,
      saveText: billingPeriod === 'annually' 
        ? (currency === 'NGN' ? 'Saved 20% with Annual Billing' : 'Saved 20% with Annual') 
        : (currency === 'NGN' ? 'Switch to Annual for 20% off' : 'Switch to Annual for 20% off')
    };
  };

  const calculatorInfo = calculatePlanDetails(employeeSeats);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus('success');
    setNewsletterEmail('');
    setTimeout(() => setNewsletterStatus('idle'), 4000);
  };

  const faqs = [
    {
      question: "How does the multi-tenant isolation work?",
      answer: "Every organization receives an isolated, crypto-verified sandbox directory context. Your employee data, payroll logs, and file uploads are partitioned dynamically using cloud security policies. There is zero risk of cross-tenant data bleed."
    },
    {
      question: "Can I upgrade or downgrade my subscription plan later?",
      answer: "Absolutely. You can scale your seat limit and features up or down at any time. When upgrading, changes are pro-rated instantly. Downgrades take effect at the start of your next billing cycle."
    },
    {
      question: "Are there any hidden set-up fees or training charges?",
      answer: "No. PeopleCloud HRIS operates on a completely transparent subscription model. Standard templates, automatic employee onboarding, and full self-service modules are completely pre-configured and ready to deploy."
    },
    {
      question: "What compliance standards do your audit trails meet?",
      answer: "Our Audit Trail module compiles crypto-verified chronological ledger logs. Every action is registered with IP tracking, role authority level, and before/after details. These logs can be exported directly as high-fidelity, secure PDF reports suitable for standard audits."
    },
    {
      question: "Do you offer localized tax calculations for Payroll?",
      answer: "Yes. Our Payroll support module allows setting up localized benefit deductions, tax structures, and bonus categories. These can be adjusted dynamically in the Settings workspace according to your regional regulations."
    }
  ];

  const featuresList = [
    {
      icon: <Users className="w-5 h-5 text-indigo-600" />,
      title: "Unified Profile Directory",
      desc: "Maintain rich digital portfolios containing personal information, role-based hierarchies, emergency contacts, and active contracts."
    },
    {
      icon: <Calendar className="w-5 h-5 text-emerald-600" />,
      title: "Interactive Leave Pipelines",
      desc: "Manage multi-tier holiday policies, track real-time vacation accruals, and approve requests via interactive calendars."
    },
    {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      title: "Autonomous Time Tracker",
      desc: "Implement precise check-in clocks with location-verification logs, overtime thresholds, and weekly summary exports."
    },
    {
      icon: <Coins className="w-5 h-5 text-rose-600" />,
      title: "Compliant Payroll Workspace",
      desc: "Structure customized allowances, calculate automatic deductions, generate secure corporate payslips, and review reports."
    },
    {
      icon: <FileText className="w-5 h-5 text-indigo-600" />,
      title: "Crypto-Verified Audit Ledgers",
      desc: "Generate complete, chronological records of all operations. Query by user or module, and export filtered results to beautiful PDFs."
    },
    {
      icon: <Briefcase className="w-5 h-5 text-teal-600" />,
      title: "Recruitment Pipeline Hub",
      desc: "Publish open requisitions, review candidate applications inside a visual kanban board, and execute tailored onboarding workflows."
    }
  ];

  const planTiers = [
    {
      name: "Starter",
      price: billingPeriod === 'annually' ? 39 : 49,
      period: "mo",
      description: "Best for growing teams and startups establishing modern HR processes.",
      features: [
        "Up to 15 Employee Seats",
        "Unified Profile Directory",
        "Self-Service HR Request Hub",
        "Standard Leave Management",
        "Email Support (24h response)",
        "Secure Firebase Auth Security"
      ],
      popular: false,
      cta: "Starter"
    },
    {
      name: "Growth",
      price: billingPeriod === 'annually' ? 119 : 149,
      period: "mo",
      description: "Comprehensive solution designed for medium-scale businesses seeking automation.",
      features: [
        "Up to 100 Employee Seats",
        "Everything in Starter",
        "Autonomous Time Clocks",
        "Active Overtime Tracker",
        "Payroll Structuring & Deductions",
        "Priority Support (4h response)"
      ],
      popular: true,
      cta: "Growth"
    },
    {
      name: "Enterprise",
      price: billingPeriod === 'annually' ? 399 : 499,
      period: "mo",
      description: "Fully-equipped package built for complex compliance and security needs.",
      features: [
        "Unlimited Employee Seats",
        "Everything in Growth",
        "Crypto-Verified Audit Ledgers",
        "High-Fidelity PDF Exporting",
        "Multi-Tenant Admin Isolation",
        "Dedicated Account Success Partner"
      ],
      popular: false,
      cta: "Enterprise"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white" id="marketing-root">
      
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-indigo-950 bg-clip-text text-transparent">PEOPLECLOUD</span>
              <span className="text-[9px] font-bold tracking-widest text-indigo-600 block -mt-1 uppercase">ENTERPRISE OS</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#calculator" className="hover:text-indigo-600 transition-colors">Seat Calculator</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Plans</a>
            <a href="#testimonials" className="hover:text-indigo-600 transition-colors">Success Stories</a>
            <a href="#faqs" className="hover:text-indigo-600 transition-colors">FAQ</a>
          </nav>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <button 
                onClick={onGoToDashboard}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button 
                  onClick={onLoginClick}
                  className="px-4 py-2 text-slate-700 hover:text-slate-900 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => onGetStarted()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Register Workspace
                </button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-600 hover:text-slate-900"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 px-4 py-4 space-y-3 animate-fade-in">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
            >
              Features
            </a>
            <a 
              href="#calculator" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
            >
              Seat Calculator
            </a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
            >
              Plans
            </a>
            <a 
              href="#testimonials" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
            >
              Success Stories
            </a>
            <a 
              href="#faqs" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
            >
              FAQ
            </a>
            
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              {isLoggedIn ? (
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGoToDashboard();
                  }}
                  className="w-full py-2.5 bg-indigo-600 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLoginClick();
                    }}
                    className="w-full py-2 text-center text-slate-700 font-semibold text-xs hover:bg-slate-50 rounded-lg"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onGetStarted();
                    }}
                    className="w-full py-2.5 text-center bg-slate-900 text-white font-semibold text-xs rounded-xl"
                  >
                    Register Workspace
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 overflow-hidden bg-gradient-to-b from-white via-indigo-50/20 to-slate-50">
        
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            
            {/* Promo badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full animate-fade-in shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
              <span>SaaS Platform with Interactive Multi-Tenant Isolation</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] font-display">
              The Enterprise-Grade <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 bg-clip-text text-transparent">People OS</span> for Modern Organizations
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Consolidate core HR databases, precise time-clocks, automated compliant salary computations, holiday pipelines, and secure PDF audit trails in one unified subscription-backed workspace.
            </p>

            {/* Hero CTAs */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onGetStarted()}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-100 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Deploy Free 14-Day Trial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onLoginClick}
                className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Browse Demo Accounts</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Visual Mini Badges */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> No Credit Card Required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> Instant Setup (90 Secs)
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> SOC2 Verified Trails
              </span>
            </div>
          </div>

          {/* Mockup Dashboard Preview */}
          <div className="mt-16 bg-white border border-slate-200/80 rounded-2xl shadow-2xl overflow-hidden max-w-5xl mx-auto p-4 sm:p-6 animate-slide-up relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500"></div>
            
            {/* Window control bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-200 block"></span>
                <span className="w-3 h-3 rounded-full bg-slate-200 block"></span>
                <span className="w-3 h-3 rounded-full bg-slate-200 block"></span>
              </div>
              <div className="bg-slate-50 px-6 py-1 rounded-md border border-slate-200/60 font-mono text-[10px]">
                tenant://peoplecloud.com/app/dashboard
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-ping"></span>
                <span className="text-[10px] text-emerald-600">Enterprise Live Console</span>
              </div>
            </div>

            {/* Simulated Live Stat Grid */}
            <div className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100/60 text-left">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Total Headcount</span>
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">124</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">9 new hires this month</p>
              </div>

              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100/60 text-left">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Payroll Run</span>
                  <Coins className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">$84,150</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Auto-compiled & secure</p>
              </div>

              <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100/60 text-left">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Leave</span>
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">14 Days</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">4 team members off today</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-left">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Security Logs</span>
                  <Shield className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-2">Crypto</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Verified audit chains</p>
              </div>
            </div>

            {/* Graphic design element */}
            <div className="mt-6 p-4 bg-slate-900 rounded-xl text-left font-mono text-[11px] text-indigo-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-indigo-500">&gt;_</span>
                <span>Active subscription: Enterprise Plan (Multi-Tenant isolated database)</span>
              </div>
              <span className="text-emerald-400 text-xs font-bold">[VERIFIED]</span>
            </div>
          </div>

        </div>
      </section>

      {/* PRODUCT CORE PILLARS SECTION */}
      <section id="features" className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-extrabold text-indigo-600 tracking-widest uppercase">The Features Matrix</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Enterprise Mechanics. Elegant Experiences.
            </h2>
            <p className="text-slate-500 text-sm">
              We engineered PeopleCloud to bridge the gap between heavy compliance systems and fast-paced user software. Empower employees while capturing bulletproof organizational records.
            </p>
          </div>

          {/* Grid Cards */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuresList.map((f, i) => (
              <div 
                key={i} 
                className="p-6 bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100/40 transition-all text-left space-y-4 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform border border-slate-100">
                  {f.icon}
                </div>
                <h4 className="text-sm font-bold text-slate-900 font-display">{f.title}</h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* INTERACTIVE SEAT PRICING CALCULATOR */}
      <section id="calculator" className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-extrabold text-indigo-600 tracking-widest uppercase">Subscription Slider</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Calculate Your Subscription Live
            </h2>
            <p className="text-slate-500 text-sm">
              We charge transparently based on active team seats. Slide the bar to find your estimated monthly cost and matched feature tier.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-5">
            
            {/* Left Column: Interactive Controls */}
            <div className="p-8 md:col-span-3 space-y-8 border-b md:border-b-0 md:border-r border-slate-100 text-left">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Step 1: Billing Frequency</h4>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${billingPeriod === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Monthly Bill
                  </button>
                  <button 
                    onClick={() => setBillingPeriod('annually')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${billingPeriod === 'annually' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>Annually</span>
                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Save 20%</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 2: Number of Employee Seats</h4>
                  <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-extrabold text-sm">
                    {employeeSeats} Seats
                  </div>
                </div>

                <div className="relative pt-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="200" 
                    value={employeeSeats} 
                    onChange={(e) => setEmployeeSeats(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold pt-2">
                    <span>1 Employee</span>
                    <span>50 Seats</span>
                    <span>100 Seats (Growth Tier Limit)</span>
                    <span>200+ Seats</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Dynamic Multi-Tenant Provisioning</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">As you scale, our server automatically isolates and shards metadata indexes so report outputs build instantly.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Matched Plan Summary */}
            <div className="p-8 md:col-span-2 bg-slate-900 text-white flex flex-col justify-between text-left relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles className="w-32 h-32 text-white" />
              </div>

              <div className="space-y-6 relative z-10">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-indigo-400 bg-indigo-950 border border-indigo-800 px-2 py-0.5 rounded-full uppercase">
                    Matched Feature Tier
                  </span>
                  <h3 className="text-3xl font-extrabold text-white mt-2 font-display">{calculatorInfo.plan} Plan</h3>
                  <p className="text-xs text-slate-400 mt-1">{calculatorInfo.limitText}</p>
                </div>

                <div className="py-4 border-y border-slate-800">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold">{currency === 'NGN' ? '₦' : '$'}{calculatorInfo.totalCost.toLocaleString()}</span>
                    <span className="text-xs text-slate-400">/ {billingPeriod === 'annually' ? 'year' : 'month'}</span>
                  </div>
                  <p className="text-[10px] text-indigo-300 font-bold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{calculatorInfo.saveText}</span>
                  </p>
                </div>

                <ul className="space-y-2 text-[11px] text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 block shrink-0"></span>
                    <span>Database sharding for {employeeSeats} active profiles</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 block shrink-0"></span>
                    <span>{calculatorInfo.plan === 'Starter' ? 'Standard Core Modules' : 'Advanced Compliance & Payroll'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 block shrink-0"></span>
                    <span>Multi-tenant isolation security sharded</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onGetStarted(calculatorInfo.plan)}
                className="mt-8 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-950 hover:shadow-indigo-900 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Deploy with {calculatorInfo.plan} Tier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* STATIC SUBSCRIPTION PLANS MATRIX */}
      <section id="pricing" className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-extrabold text-indigo-600 tracking-widest uppercase">Transparent Pricing</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Plans Built For Scales of All Sizes
            </h2>
            <p className="text-slate-500 text-sm">
              Deploy a subscription-sharded corporate directory workspace suited to your workload context. Every account starts on a 14-day premium trial period.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {planTiers.map((p, idx) => {
              const displayPrice = currency === 'NGN' ? p.price * 1500 : p.price;
              return (
                <div 
                  key={idx} 
                  className={`p-8 rounded-3xl border text-left flex flex-col justify-between relative transition-all ${p.popular ? 'border-indigo-500 shadow-xl shadow-indigo-100/40 bg-white ring-1 ring-indigo-500 scale-102 z-10' : 'border-slate-200 bg-slate-50/50'}`}
                >
                  {p.popular && (
                    <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white font-extrabold text-[10px] tracking-widest uppercase px-3 py-1 rounded-full shadow-md shadow-indigo-200">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-extrabold text-slate-900 font-display">{p.name}</h4>
                      <p className="text-slate-500 text-[11px] mt-1 leading-relaxed min-h-[32px]">{p.description}</p>
                    </div>

                    <div className="py-4 border-y border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-slate-900">{currency === 'NGN' ? '₦' : '$'}{displayPrice.toLocaleString()}</span>
                        <span className="text-xs text-slate-500">/ {p.period}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 font-medium">Billed {billingPeriod === 'annually' ? 'annually' : 'monthly'} {currency === 'NGN' && '(NGN equivalent)'}</span>
                    </div>

                    <ul className="space-y-3 text-[11px] text-slate-600">
                      {p.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => onGetStarted(p.name)}
                    className={`mt-8 w-full py-3 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${p.popular ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span>Select {p.name}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* CUSTOMER TESTIMONIALS */}
      <section id="testimonials" className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-extrabold text-indigo-600 tracking-widest uppercase">Trusted Reviews</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Approved by Operations and HR Teams
            </h2>
            <p className="text-slate-500 text-sm">
              Discover how companies scaled operations, secured historical compliance ledgers, and streamlined timesheet check-ins using PeopleCloud HRIS.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4 text-left">
              <div className="flex gap-1 text-amber-400">
                {"★★★★★".split("").map((s, i) => <span key={i} className="text-sm">{s}</span>)}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed italic">
                "The multi-tenant architecture gave our legal advisors extreme peace of mind. We sharded separate branch directories and generate fully compliant PDF audit lists for stakeholders in seconds."
              </p>
              <div className="flex items-center gap-3 border-t border-slate-50 pt-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                  ML
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Marcus Lindqvist</h5>
                  <p className="text-[10px] text-slate-400">Director of People Ops, NordTech</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4 text-left">
              <div className="flex gap-1 text-amber-400">
                {"★★★★★".split("").map((s, i) => <span key={i} className="text-sm">{s}</span>)}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed italic">
                "Our employees love the intuitive time clock and request hub. Managers review leave balances instantly from unified visual calendars, which completely eliminated manual spreadsheet calculations."
              </p>
              <div className="flex items-center gap-3 border-t border-slate-50 pt-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                  SK
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">Sonia Kapoor</h5>
                  <p className="text-[10px] text-slate-400">HR Business Partner, Apex Digital</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4 text-left">
              <div className="flex gap-1 text-amber-400">
                {"★★★★★".split("").map((s, i) => <span key={i} className="text-sm">{s}</span>)}
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed italic">
                "Setting up custom salary allowances and local benefit deductions took less than five minutes. Our payroll auditing loops are now completely stress-free every month-end."
              </p>
              <div className="flex items-center gap-3 border-t border-slate-50 pt-4">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                  JC
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">James Corden</h5>
                  <p className="text-[10px] text-slate-400">CFO, Horizon Retail Ventures</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FAQS ACCORDION */}
      <section id="faqs" className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-xs font-extrabold text-indigo-600 tracking-widest uppercase">Answers Ready</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Frequently Answered Questions
            </h2>
            <p className="text-slate-500 text-sm">
              Still curious about subscriptions, system boundaries, or multi-tenancy? Here is a clear breakdown of the core details.
            </p>
          </div>

          <div className="space-y-4 text-left">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="border border-slate-200 rounded-2xl bg-slate-50/40 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-slate-800 hover:text-slate-950 font-bold text-xs sm:text-sm text-left transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
                
                {openFaq === i && (
                  <div className="px-6 pb-4 pt-1 border-t border-slate-100 text-slate-500 text-xs leading-relaxed animate-fade-in bg-white">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* COMPLIANCE / FINAL CTA SECTION */}
      <section className="py-20 bg-slate-900 text-white relative overflow-hidden text-left">
        <div className="absolute inset-0 bg-[radial-gradient(#312e81_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-4 max-w-xl">
            <span className="text-xs font-black tracking-widest text-indigo-400 bg-indigo-950 border border-indigo-800 px-2.5 py-1 rounded-full uppercase">
              Free Premium Trial
            </span>
            <h2 className="text-3xl font-extrabold text-white font-display">
              Ready to Upgrade Your Corporate Back-Office?
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Activate your isolated database within ninety seconds. Standard test records are automatically seeded so you can test compliance exporters, leave calendars, and payroll sheets instantly.
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row md:flex-col lg:flex-row gap-4">
            <button
              onClick={() => onGetStarted()}
              className="px-6 py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-950 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Deploy Workspace Sandbox</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLoginClick}
              className="px-6 py-4.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              Access Demo Workspace
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900 text-left text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-10">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-white text-sm tracking-tight">PEOPLECLOUD</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              The modern People Operations Operating System equipped with multi-tenant directory sharding and compliance-certified chronological event audit trails.
            </p>
            <div className="text-[10px] text-slate-600">
              © {new Date().getFullYear()} PeopleCloud Inc. All rights reserved.
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs">Product Features</h4>
            <ul className="space-y-2 text-[11px] text-slate-500">
              <li><a href="#features" className="hover:text-white transition-colors">Unified Profile Directory</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Autonomous Time Clocks</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Compliant Payroll Engine</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Crypto-Verified Audit Ledgers</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs">Legal & Compliance</h4>
            <ul className="space-y-2 text-[11px] text-slate-500">
              <li><a href="#faqs" className="hover:text-white transition-colors">Data Privacy Policy</a></li>
              <li><a href="#faqs" className="hover:text-white transition-colors">Multi-Tenant Isolation SLA</a></li>
              <li><a href="#faqs" className="hover:text-white transition-colors">SOC2 Security Certification</a></li>
              <li><a href="#faqs" className="hover:text-white transition-colors">Standard Service Terms</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-white font-bold text-xs">Stay Informed</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Subscribe to the PeopleCloud HR insights digest for monthly updates on SaaS optimization and regulatory guidelines.
            </p>
            
            {newsletterStatus === 'success' ? (
              <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-indigo-400 font-semibold text-[11px] animate-fade-in">
                ✓ Thank you! You've been subscribed.
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Enter work email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:border-indigo-600"
                />
                <button 
                  type="submit"
                  className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                >
                  Join
                </button>
              </form>
            )}
          </div>

        </div>
      </footer>

    </div>
  );
}
