import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email("Invalid email address");
const phoneSchema = z.string().regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number");

const ForgotPasswordDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Email reset
  const [email, setEmail] = useState('');
  
  // Phone/WhatsApp reset
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resetMethod, setResetMethod] = useState<'email' | 'sms' | 'whatsapp'>('email');

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: "Invalid Email",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast({
        title: "Reset Link Sent",
        description: "Check your email for the password reset link.",
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (method: 'sms' | 'whatsapp') => {
    const validation = phoneSchema.safeParse(phone);
    if (!validation.success) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid phone number with country code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResetMethod(method);

    try {
      // Note: SMS/WhatsApp OTP requires additional backend setup
      // This is a placeholder for the actual implementation
      // You would need to integrate with Twilio or similar service
      
      toast({
        title: "OTP Sent",
        description: `A verification code has been sent to your ${method === 'sms' ? 'phone' : 'WhatsApp'}.`,
      });
      setOtpSent(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to send OTP via ${method}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Verify OTP with backend
      // This would need to be implemented with your SMS/WhatsApp provider
      
      toast({
        title: "OTP Verified",
        description: "You can now reset your password.",
      });
      // Redirect to password reset page or show new password form
    } catch (error: any) {
      toast({
        title: "Invalid OTP",
        description: "The code you entered is incorrect",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="px-0 font-normal text-primary">
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Choose how you'd like to receive your password reset verification.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email" className="gap-1">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-1">
              <Phone className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="email" className="space-y-4 mt-4">
            <form onSubmit={handleEmailReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="sms" className="space-y-4 mt-4">
            {!otpSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-phone-sms">Phone Number</Label>
                  <Input
                    id="reset-phone-sms"
                    type="tel"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g., +91 for India)</p>
                </div>
                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={() => handleSendOTP('sms')}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Send SMS OTP
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-sms">Enter OTP</Label>
                  <Input
                    id="otp-sms"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                  />
                </div>
                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={handleVerifyOTP}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Verify OTP
                </Button>
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full"
                  onClick={() => setOtpSent(false)}
                >
                  Send again
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="whatsapp" className="space-y-4 mt-4">
            {!otpSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-phone-wa">WhatsApp Number</Label>
                  <Input
                    id="reset-phone-wa"
                    type="tel"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g., +91 for India)</p>
                </div>
                <Button 
                  type="button" 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  disabled={isLoading}
                  onClick={() => handleSendOTP('whatsapp')}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Send WhatsApp OTP
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-wa">Enter OTP</Label>
                  <Input
                    id="otp-wa"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                  />
                </div>
                <Button 
                  type="button" 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  disabled={isLoading}
                  onClick={handleVerifyOTP}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Verify OTP
                </Button>
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full"
                  onClick={() => setOtpSent(false)}
                >
                  Send again
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;
