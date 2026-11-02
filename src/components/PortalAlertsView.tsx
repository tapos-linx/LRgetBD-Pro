import React, { useState } from 'react';
import { AlertTriangle, X, ExternalLink, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { verifyStatus } from '../services/geminiService';

export interface PortalAlert {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  linkUrl?: string;
  linkText?: string;
  groundingUrls?: { title: string; url: string }[];
}

const INITIAL_ALERTS: PortalAlert[] = [
  {
    id: 'migration-alert',
    type: 'warning',
    title: 'Portal Migration Notice',
    message: 'Official e-Porcha services have transitioned to the Digital Land Record Management System (DLRMS).',
    linkUrl: 'https://dlrms.land.gov.bd',
    linkText: 'Visit Official DLRMS Portal'
  }
];

export const PortalAlertsView: React.FC = () => {
  const [visibleAlerts, setVisibleAlerts] = useState<PortalAlert[]>(INITIAL_ALERTS);
  const [isVerifying, setIsVerifying] = useState(false);

  const dismissAlert = (id: string) => {
    setVisibleAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyStatus("Is eporcha.tech currently working and what is the status of official DLRMS services for land records?");
      
      const newAlert: PortalAlert = {
        id: 'status-check-' + Date.now(),
        type: 'success',
        title: 'Status Verification',
        message: result.text || 'Verification complete.',
        groundingUrls: result.groundingMetadata?.groundingChunks
          ?.filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, url: c.web.uri }))
          .slice(0, 3)
      };
      
      setVisibleAlerts(prev => [newAlert, ...prev]);
    } catch (error) {
      console.error(error);
      alert('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      <button
        onClick={handleVerify}
        disabled={isVerifying}
        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-2 mb-2"
      >
        {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        {isVerifying ? 'Verifying status...' : 'Verify current portal status via AI'}
      </button>

      {visibleAlerts.map((alert) => (
        <div 
          key={alert.id}
          className={`flex items-start gap-4 p-4 rounded-xl border ${
            alert.type === 'warning' 
              ? 'bg-amber-950/30 border-amber-500/50' 
              : alert.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/50'
              : 'bg-blue-950/30 border-blue-500/50'
          }`}
        >
          {alert.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          )}
          
          <div className="flex-1">
            <h4 className={`text-sm font-bold ${
              alert.type === 'warning' ? 'text-amber-100' : 
              alert.type === 'success' ? 'text-emerald-100' : 'text-blue-100'
            }`}>
              {alert.title}
            </h4>
            <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
            {alert.linkUrl && (
              <a 
                href={alert.linkUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold mt-2 text-emerald-400 hover:text-emerald-300"
              >
                {alert.linkText} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {alert.groundingUrls && (
                <div className="mt-2 space-y-1">
                    {alert.groundingUrls.map((g, i) => (
                        <a key={i} href={g.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-slate-400 hover:text-slate-200 truncate">
                            {g.title}
                        </a>
                    ))}
                </div>
            )}
          </div>
          
          <button 
            onClick={() => dismissAlert(alert.id)}
            className="text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
