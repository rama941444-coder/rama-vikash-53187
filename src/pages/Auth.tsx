import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lampOpen, setLampOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Auto-open lamp after 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setLampOpen(true);
      setTimeout(() => setShowForm(true), 800);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLampClick = () => {
    if (!lampOpen) {
      setLampOpen(true);
      setTimeout(() => setShowForm(true), 800);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = emailSchema.safeParse(loginEmail);
    const passwordValidation = passwordSchema.safeParse(loginPassword);

    if (!emailValidation.success) {
      toast({ title: "Invalid Email", description: emailValidation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!passwordValidation.success) {
      toast({ title: "Invalid Password", description: passwordValidation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });

    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    } else {
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValidation = emailSchema.safeParse(signupEmail);
    const passwordValidation = passwordSchema.safeParse(signupPassword);

    if (!emailValidation.success) {
      toast({ title: "Invalid Email", description: emailValidation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!passwordValidation.success) {
      toast({ title: "Invalid Password", description: passwordValidation.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!signupUsername.trim()) {
      toast({ title: "Username Required", description: "Please enter a username", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username: signupUsername },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        toast({ title: "Account Exists", description: "This email is already registered. Please login instead.", variant: "destructive" });
      } else {
        toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
      }
      setIsLoading(false);
    } else {
      toast({ title: "Account Created!", description: "Please check your email to confirm your account." });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1a1a3e 0%, #0a0a1a 50%, #000000 100%)',
      }}
    >
      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `hsl(${200 + Math.random() * 60}, 80%, ${60 + Math.random() * 30}%)`,
              opacity: 0.3 + Math.random() * 0.5,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* 3D Lamp */}
      <div 
        className="relative cursor-pointer mb-8 z-10"
        onClick={handleLampClick}
        style={{ perspective: '1000px' }}
      >
        {/* Lamp cord */}
        <div className="w-[2px] h-16 bg-gradient-to-b from-gray-600 to-gray-400 mx-auto" />
        
        {/* Lamp shade - 3D trapezoid */}
        <div 
          className="relative mx-auto transition-all duration-1000 ease-out"
          style={{
            width: lampOpen ? '200px' : '160px',
            height: '60px',
            background: 'linear-gradient(180deg, #2a2a4a 0%, #1a1a3a 100%)',
            clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
            boxShadow: lampOpen 
              ? '0 0 60px 20px rgba(255, 200, 50, 0.3), 0 0 120px 40px rgba(255, 180, 30, 0.15)' 
              : 'none',
            transform: lampOpen ? 'rotateX(5deg)' : 'rotateX(0deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Light bulb inside */}
          <div 
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full transition-all duration-700"
            style={{
              width: lampOpen ? '20px' : '12px',
              height: lampOpen ? '20px' : '12px',
              background: lampOpen 
                ? 'radial-gradient(circle, #fff9c4 0%, #ffcc02 50%, #ff9800 100%)' 
                : '#333',
              boxShadow: lampOpen 
                ? '0 0 30px 10px rgba(255, 200, 50, 0.6), 0 0 80px 30px rgba(255, 180, 30, 0.3)' 
                : 'none',
            }}
          />
        </div>

        {/* Light beam - cone shape */}
        <div 
          className="mx-auto transition-all duration-1000 ease-out origin-top"
          style={{
            width: '0px',
            height: '0px',
            borderLeft: lampOpen ? '180px solid transparent' : '0px solid transparent',
            borderRight: lampOpen ? '180px solid transparent' : '0px solid transparent',
            borderTop: lampOpen ? '400px solid rgba(255, 220, 80, 0.06)' : '0px solid transparent',
            opacity: lampOpen ? 1 : 0,
            filter: 'blur(2px)',
          }}
        />

        {!lampOpen && (
          <p className="text-center text-gray-500 mt-4 text-sm animate-pulse">
            ✨ Click the lamp to illuminate
          </p>
        )}
      </div>

      {/* Login Form - appears from the light */}
      <div 
        className={`absolute transition-all duration-1000 ease-out z-20 w-full max-w-md px-4 ${
          showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
        style={{ 
          top: '45%',
          transform: showForm ? 'translateY(-50%)' : 'translateY(-40%)',
        }}
      >
        <div 
          className="rounded-2xl p-8 backdrop-blur-xl border"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,50,0.9) 0%, rgba(10,10,30,0.95) 100%)',
            borderColor: 'rgba(100, 140, 255, 0.2)',
            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 40px rgba(100, 140, 255, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Title */}
          <div className="text-center mb-6">
            <h1 
              className="text-3xl font-black tracking-tight mb-1"
              style={{
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI Code Analyzer
            </h1>
            <p className="text-sm text-gray-400">Sign in to unlock the power of AI</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex mb-6 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === 'login' 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                activeTab === 'signup' 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-gray-300 text-sm">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-gray-300 text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-5 shadow-lg shadow-blue-500/20" 
                disabled={isLoading}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username" className="text-gray-300 text-sm">Username</Label>
                <Input
                  id="signup-username"
                  type="text"
                  placeholder="Choose a username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-gray-300 text-sm">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-gray-300 text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 12 chars, mixed case, number, special"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-5 shadow-lg shadow-purple-500/20" 
                disabled={isLoading}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Float animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default Auth;
