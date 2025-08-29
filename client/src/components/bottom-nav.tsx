import { useLocation } from 'wouter';

export default function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: '/', icon: 'fas fa-home', label: 'Accueil', testId: 'nav-home' },
    { path: '/permit-form', icon: 'fas fa-plus', label: 'Nouveau', testId: 'nav-new' },
    { path: '/scanner', icon: 'fas fa-qrcode', label: 'Scanner', testId: 'nav-scanner' },
    { path: '/admin', icon: 'fas fa-cog', label: 'Admin', testId: 'nav-admin' }
  ];

  return (
    <>
      {/* Bottom Navigation (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-40">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center p-2 ${
                location === item.path ? 'text-primary' : 'text-muted-foreground'
              }`}
              data-testid={item.testId}
            >
              <i className={`${item.icon} text-xl`}></i>
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setLocation('/permit-form')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg floating-action hover:bg-primary/90 transition-all duration-300 md:hidden"
        data-testid="fab-new-permit"
      >
        <i className="fas fa-plus text-xl"></i>
      </button>
    </>
  );
}
