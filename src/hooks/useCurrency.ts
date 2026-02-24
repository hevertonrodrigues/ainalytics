import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface ExchangeRates {
  USD_BRL: number;
  USD_EUR: number;
}

export function useCurrency() {
  const { i18n } = useTranslation();
  const [rates, setRates] = useState<ExchangeRates>({
    USD_BRL: 5.0, // fallback
    USD_EUR: 1.2, // fallback
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRates() {
      try {
        const { data, error } = await supabase
          .from('general_settings')
          .select('key, value')
          .in('key', ['USD_BRL', 'USD_EUR']);

        if (error) throw error;

        const newRates = { ...rates };
        data?.forEach((row) => {
          if (row.key === 'USD_BRL') newRates.USD_BRL = parseFloat(row.value);
          if (row.key === 'USD_EUR') newRates.USD_EUR = parseFloat(row.value);
        });

        setRates(newRates);
      } catch (err) {
        console.error('Failed to load exchange rates:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatPrice = (usdPrice: number | string): string => {
    const rawStr = String(usdPrice).replace(/[^0-9.]/g, '');
    const rawPrice = parseFloat(rawStr);

    if (isNaN(rawPrice)) return String(usdPrice);

    const lang = i18n.language || 'en';

    if (lang.startsWith('pt')) {
      const converted = rawPrice * rates.USD_BRL;
      return `R$ ${converted.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    if (lang.startsWith('es')) {
      const converted = rawPrice * rates.USD_EUR;
      return `€ ${converted.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    return `$${rawPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return { formatPrice, loading };
}
