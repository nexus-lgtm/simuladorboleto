
import React, { useState, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { BoletoData, CalculationResult } from './types';
import { calculateBoleto, formatCurrency, formatDate } from './utils/formatters';
import { scanBoleto } from './services/geminiService';

const INITIAL_STATE: BoletoData = {
  supplier: '',
  payer: '',
  originalValue: 0,
  dueDate: '',
  paymentDate: new Date().toISOString().split('T')[0],
  finePercent: 2,
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<BoletoData>(INITIAL_STATE);

  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const results = useMemo<CalculationResult>(() => {
    if (!formData.dueDate || !formData.paymentDate || formData.originalValue <= 0) {
      return { daysLate: 0, interestValue: 0, fineValue: 0, updatedTotal: 0, isLate: false };
    }
    return calculateBoleto(
      formData.originalValue,
      formData.dueDate,
      formData.paymentDate,
      formData.finePercent
    );
  }, [formData]);

  const isInvalidDateRange = useMemo(() => {
    if (!formData.dueDate || !formData.paymentDate) return false;
    return new Date(formData.paymentDate) < new Date(formData.dueDate);
  }, [formData.dueDate, formData.paymentDate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'originalValue' || name === 'finePercent' ? parseFloat(value) || 0 : value
    }));
  };

  const handleReset = () => {
    setFormData(INITIAL_STATE);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    try {
      const base64 = await fileToBase64(file);
      const data = await scanBoleto(base64, file.type);
      
      setFormData(prev => ({
        ...prev,
        supplier: data.supplier,
        payer: data.payer,
        originalValue: data.value,
        dueDate: data.dueDate,
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao processar arquivo");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportPDF = async () => {
    if (!pdfTemplateRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(pdfTemplateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`atualizacao_boleto_${formData.supplier.replace(/\s/g, '_') || 'documento'}.pdf`);
    } catch (error) {
      console.error('Export Error:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Atualizador de Boletos <span className="text-indigo-600">Pro</span>
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Escaneie seu boleto (PDF ou Foto) e deixe o sistema calcular os encargos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Form Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
              <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Dados do Título
              </h2>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleReset}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-full text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Limpar
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                >
                  {isScanning ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      ...
                    </span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Escanear
                    </>
                  )}
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Beneficiário/Fornecedor</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  placeholder="Nome de quem recebe"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pagador</label>
                <input
                  type="text"
                  name="payer"
                  value={formData.payer}
                  onChange={handleInputChange}
                  placeholder="Nome de quem paga"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Original (R$)</label>
                <input
                  type="number"
                  name="originalValue"
                  value={formData.originalValue || ''}
                  onChange={handleInputChange}
                  placeholder="0,00"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pagamento</label>
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none ${
                      isInvalidDateRange ? 'border-red-500 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                </div>
              </div>

              {isInvalidDateRange && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800 text-sm">
                  <svg className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Atenção: A data de pagamento é anterior ao vencimento. Nenhum encargo será aplicado.</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Multa (%)</label>
                <input
                  type="number"
                  name="finePercent"
                  value={formData.finePercent || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex flex-col gap-4 h-full">
            <div className={`rounded-2xl shadow-lg p-8 text-white relative overflow-hidden flex-1 transition-colors duration-500 ${isInvalidDateRange ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-lg font-medium opacity-90">Total Atualizado</h2>
                {results.isLate ? (
                  <span className="bg-red-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Em Atraso</span>
                ) : (
                  <span className="bg-emerald-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Em Dia</span>
                )}
              </div>

              <div className="text-4xl font-bold mb-6">
                {formatCurrency(results.updatedTotal || formData.originalValue)}
              </div>
              
              <div className={`space-y-3 pt-6 border-t text-sm ${isInvalidDateRange ? 'border-emerald-500/50' : 'border-indigo-500/50'}`}>
                <div className="flex justify-between items-center">
                  <span className="opacity-80">Valor Original:</span>
                  <span className="font-semibold">{formatCurrency(formData.originalValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-80">Dias de Atraso:</span>
                  <span className="font-semibold">{results.daysLate} dias</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`opacity-80 ${isInvalidDateRange ? 'text-emerald-100' : 'text-orange-200'}`}>Multa ({formData.finePercent}%):</span>
                  <span className={`font-semibold ${isInvalidDateRange ? 'text-emerald-100' : 'text-orange-200'}`}>+{formatCurrency(results.fineValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`opacity-80 ${isInvalidDateRange ? 'text-emerald-100' : 'text-orange-200'}`}>Juros (1% a.m. pro-rata):</span>
                  <span className={`font-semibold ${isInvalidDateRange ? 'text-emerald-100' : 'text-orange-200'}`}>+{formatCurrency(results.interestValue)}</span>
                </div>
              </div>

              <div className={`mt-8 p-4 rounded-xl text-xs italic ${isInvalidDateRange ? 'bg-emerald-700/50 text-emerald-100' : 'bg-indigo-700/50 text-indigo-100'}`}>
                {isInvalidDateRange 
                  ? "* Pagamento antecipado ou no dia do vencimento. Não há incidência de encargos moratórios."
                  : "* O cálculo considera juros de 1% ao mês divididos proporcionalmente aos dias de atraso."
                }
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting || formData.originalValue <= 0}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.98]"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gerando Documento...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF Premium
                </>
              )}
            </button>
          </div>
        </div>

        {/* Informational Footer */}
        <div className="mt-12 p-6 bg-slate-100 rounded-xl border border-slate-200">
           <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Resumo da Regra de Cálculo</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600">
              <div>
                <p className="font-semibold text-slate-800 mb-1">Juros de Mora:</p>
                <p>Aplicamos juros de 1% ao mês (pro-rata die) multiplicados pelo número de dias em atraso. Se o pagamento for feito até a data de vencimento, os juros são zero.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Multa:</p>
                <p>Valor percentual aplicado sobre o valor original do boleto apenas se houver atraso no pagamento.</p>
              </div>
           </div>
        </div>
      </div>

      {/* HIDDEN PREMIUM PDF TEMPLATE */}
      <div id="pdf-template" ref={pdfTemplateRef} style={{ padding: '40px', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ color: '#1e293b', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Valor Atualizado do Boleto</h1>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '5px 0 0 0' }}>Emitido via Atualizador de Boletos Pro</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#4f46e5', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Documento Digital</p>
            <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Beneficiário / Fornecedor</h3>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', margin: 0 }}>{formData.supplier || 'Não informado'}</p>
          </div>
          <div>
            <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Pagador</h3>
            <p style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', margin: 0 }}>{formData.payer || 'Não informado'}</p>
          </div>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Detalhamento Financeiro</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#475569' }}>Valor Original:</span>
            <span style={{ fontWeight: '600' }}>{formatCurrency(formData.originalValue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#475569' }}>Vencimento:</span>
            <span>{formatDate(formData.dueDate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#475569' }}>Data Prevista de Pagamento:</span>
            <span>{formatDate(formData.paymentDate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#475569' }}>Dias de Atraso:</span>
            <span style={{ fontWeight: '500' }}>{results.daysLate} dia(s)</span>
          </div>
          
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#b91c1c' }}>Multa ({formData.finePercent}%):</span>
              <span style={{ color: '#b91c1c', fontWeight: '600' }}>+ {formatCurrency(results.fineValue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#b91c1c' }}>Juros de Mora (1% a.m.):</span>
              <span style={{ color: '#b91c1c', fontWeight: '600' }}>+ {formatCurrency(results.interestValue)}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '24px', padding: '16px', background: '#4f46e5', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Valor Total para Pagamento:</span>
            <span style={{ fontSize: '24px', fontWeight: '800' }}>{formatCurrency(results.updatedTotal)}</span>
          </div>
        </div>

        <div style={{ marginTop: '60px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '10px', lineHeight: '1.6', margin: 0 }}>
            * Este documento é um demonstrativo de atualização de encargos baseado nas regras contratuais brasileiras (Multa e Juros Pro-Rata). 
            O cálculo é válido exclusivamente para a data de pagamento informada ({formatDate(formData.paymentDate)}). 
            Em caso de alteração da data, uma nova atualização deve ser realizada.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '10px', textAlign: 'center', marginTop: '20px' }}>
            Gerado em {new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
