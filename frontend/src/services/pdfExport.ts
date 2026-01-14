import jsPDF from 'jspdf';
import { Message } from '../types';

interface ExportOptions {
  content: string;
  provider?: string;
  timestamp?: string;
  title?: string;
}

interface ConversationExportOptions {
  messages: Message[];
  title?: string;
}

/**
 * Export a message to PDF with clean formatting.
 * Uses jsPDF for direct text rendering (cleaner than html2canvas for text content).
 */
export async function exportMessageToPDF({
  content,
  provider,
  timestamp,
  title = 'Qodex Response',
}: ExportOptions): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 10;

  // Metadata line
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);

  const metaParts: string[] = [];
  if (provider) {
    const providerNames: Record<string, string> = {
      openai: 'OpenAI',
      mistral: 'Mistral',
      claude: 'Claude',
      cohere: 'Cohere',
    };
    metaParts.push(`Provider: ${providerNames[provider] || provider}`);
  }
  if (timestamp) {
    metaParts.push(`Generated: ${new Date(timestamp).toLocaleString()}`);
  } else {
    metaParts.push(`Exported: ${new Date().toLocaleString()}`);
  }

  pdf.text(metaParts.join('  |  '), margin, yPosition);
  yPosition += 8;

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Content
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');

  // Process content - handle markdown-like formatting
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Handle headers
    if (trimmedLine.startsWith('### ')) {
      checkPageBreak(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      const headerText = trimmedLine.replace(/^###\s*/, '');
      pdf.text(headerText, margin, yPosition);
      yPosition += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
    } else if (trimmedLine.startsWith('## ')) {
      checkPageBreak(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      const headerText = trimmedLine.replace(/^##\s*/, '');
      pdf.text(headerText, margin, yPosition);
      yPosition += 8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
    } else if (trimmedLine.startsWith('# ')) {
      checkPageBreak(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      const headerText = trimmedLine.replace(/^#\s*/, '');
      pdf.text(headerText, margin, yPosition);
      yPosition += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || /^\d+\.\s/.test(trimmedLine)) {
      // List items
      checkPageBreak(6);
      const bulletText = trimmedLine.replace(/^[-*]\s/, '• ').replace(/^\d+\.\s/, (match) => match);
      const wrappedLines = pdf.splitTextToSize(bulletText, contentWidth - 5);
      for (let i = 0; i < wrappedLines.length; i++) {
        checkPageBreak(5);
        pdf.text(wrappedLines[i], margin + (i === 0 ? 0 : 5), yPosition);
        yPosition += 5;
      }
    } else if (trimmedLine === '') {
      // Empty line - add spacing
      yPosition += 3;
    } else if (trimmedLine.startsWith('```')) {
      // Code block marker - add visual indication
      checkPageBreak(6);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
    } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      // Bold text
      checkPageBreak(6);
      pdf.setFont('helvetica', 'bold');
      const boldText = trimmedLine.replace(/^\*\*|\*\*$/g, '');
      const wrappedLines = pdf.splitTextToSize(boldText, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin, yPosition);
        yPosition += 5;
      }
      pdf.setFont('helvetica', 'normal');
    } else {
      // Regular text - wrap to fit page width
      checkPageBreak(6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      // Clean up markdown formatting for PDF
      let cleanLine = line
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markers
        .replace(/\*(.*?)\*/g, '$1')       // Remove italic markers
        .replace(/`(.*?)`/g, '$1')         // Remove inline code markers
        .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Convert links to just text

      const wrappedLines = pdf.splitTextToSize(cleanLine, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin, yPosition);
        yPosition += 5;
      }
    }
  }

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated by Qodex  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const providerStr = provider ? `-${provider}` : '';
  const filename = `qodex-response${providerStr}-${dateStr}.pdf`;

  // Download
  pdf.save(filename);
}

/**
 * Export an entire conversation to PDF with all messages.
 * Reuses the same PDF formatting as single message export.
 */
export async function exportConversationToPDF({
  messages,
  title = 'Qodex Conversation',
}: ConversationExportOptions): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 10;

  // Metadata
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Exported: ${new Date().toLocaleString()}  |  Messages: ${messages.length}`, margin, yPosition);
  yPosition += 8;

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // Process each message
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    checkPageBreak(15);

    // Message header with role
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');

    if (message.role === 'user') {
      pdf.setTextColor(59, 130, 246); // Blue for user
      pdf.text('You:', margin, yPosition);
    } else {
      pdf.setTextColor(107, 114, 128); // Gray for assistant
      const providerNames: Record<string, string> = {
        openai: 'OpenAI',
        mistral: 'Mistral',
        claude: 'Claude',
        cohere: 'Cohere',
      };
      const providerName = message.provider ? providerNames[message.provider] || message.provider : 'Qodex';
      pdf.text(`${providerName}:`, margin, yPosition);
    }

    yPosition += 7;

    // Message content
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');

    const lines = message.content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        yPosition += 3;
        continue;
      }

      // Handle markdown formatting (simplified version)
      let cleanLine = line
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1');

      const wrappedLines = pdf.splitTextToSize(cleanLine, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin + 3, yPosition);
        yPosition += 5;
      }
    }

    // Add spacing between messages
    yPosition += 8;

    // Add separator between messages (except after last one)
    if (i < messages.length - 1) {
      checkPageBreak(3);
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated by Qodex  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const filename = `qodex-${titleSlug}-${dateStr}.pdf`;

  // Download
  pdf.save(filename);
}
