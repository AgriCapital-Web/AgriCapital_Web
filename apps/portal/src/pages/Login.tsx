import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import logoGreen from "@/assets/logo-green.png";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(username, password);
    
    if (!error) {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-primary-hover p-3 sm:p-4 relative overflow-hidden">
      {/* Pattern de fond subtil */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnptMCA0YzEuMTA1IDAgMiAuODk1IDIgMnMtLjg5NSAyLTIgMi0yLS44OTUtMi0yIC44OTUtMiAyLTJ6IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-20"></div>
      
      {/* Overlay pour adoucir le fond */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
      
      <Card className="w-full max-w-[95%] sm:max-w-md shadow-strong relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="space-y-2 sm:space-y-4 text-center pb-4 sm:pb-8 px-4 sm:px-6">
          <div className="flex justify-center mb-2 sm:mb-4">
            <img src={logoGreen} alt="AgriCapital Logo" className="h-20 sm:h-32 w-auto" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-primary">
            Connexion
          </CardTitle>
        </CardHeader>
        
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="username" className="text-foreground font-medium text-sm sm:text-base">
                Nom d'utilisateur
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-10 sm:h-11 text-sm sm:text-base"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground font-medium text-sm sm:text-base">
                  Mot de passe
                </Label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs sm:text-sm text-accent hover:underline font-medium"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 sm:h-11 pr-10 text-sm sm:text-base"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 sm:h-11 w-10 sm:w-11 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-10 sm:h-11 text-sm sm:text-base font-semibold bg-primary hover:bg-primary-hover text-primary-foreground transition-all"
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm space-y-2 sm:space-y-4">
            <p className="text-muted-foreground">Système de Gestion des Planteurs & Plantations</p>
            <p className="font-semibold text-primary text-xs sm:text-sm">
              "Le partenaire idéal des producteurs agricoles"
            </p>
            <Button
              type="button"
              variant="link"
              onClick={() => navigate('/account-request')}
              className="text-accent text-xs sm:text-sm p-0 h-auto"
            >
              Demander la création d'un compte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
