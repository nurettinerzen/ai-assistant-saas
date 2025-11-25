/**
 * TemplateSelector Component
 * Modal with assistant templates for quick creation
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  ShoppingBag,
  Headphones,
  Stethoscope,
  Home,
  Briefcase,
  Search,
} from 'lucide-react';

const TEMPLATES = [
  {
    id: 'restaurant',
    name: 'Restaurant Reservations',
    description: 'Take reservations, answer menu questions, and handle booking modifications',
    icon: Calendar,
    prompt: 'You are a friendly restaurant host assistant. Help customers make reservations, answer questions about the menu, hours, and location. Always be polite and professional.',
    category: 'hospitality',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Support',
    description: 'Handle orders, track shipments, and answer product questions',
    icon: ShoppingBag,
    prompt: 'You are a helpful e-commerce support agent. Assist customers with order tracking, product information, returns, and general inquiries. Be patient and solution-oriented.',
    category: 'retail',
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'General customer service for any business',
    icon: Headphones,
    prompt: 'You are a professional customer support agent. Help customers with their questions, troubleshoot issues, and provide excellent service. Always be empathetic and helpful.',
    category: 'support',
  },
  {
    id: 'healthcare',
    name: 'Healthcare Scheduling',
    description: 'Schedule appointments, answer basic questions, collect patient info',
    icon: Stethoscope,
    prompt: 'You are a medical office assistant. Help patients schedule appointments, provide basic information about services, and collect necessary details. Follow HIPAA guidelines and be compassionate.',
    category: 'healthcare',
  },
  {
    id: 'realestate',
    name: 'Real Estate Assistant',
    description: 'Schedule property viewings, answer listing questions',
    icon: Home,
    prompt: 'You are a real estate assistant. Help potential buyers/renters schedule viewings, provide property information, and answer questions about listings. Be professional and knowledgeable.',
    category: 'realestate',
  },
  {
    id: 'professional',
    name: 'Professional Services',
    description: 'Book consultations, qualify leads, answer service questions',
    icon: Briefcase,
    prompt: 'You are a professional services assistant. Help potential clients book consultations, understand services offered, and answer general questions. Be courteous and informative.',
    category: 'professional',
  },
];

export default function TemplateSelector({ isOpen, onClose, onSelectTemplate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const filteredTemplates = TEMPLATES.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    onSelectTemplate(template);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose an Assistant Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built template or create from scratch
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Templates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 pr-2">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <div
                key={template.id}
                className="border border-neutral-200 rounded-lg p-6 hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer transition-all group"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      {template.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blank template option */}
        <div className="border-t border-neutral-200 pt-4 mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onSelectTemplate(null);
              onClose();
            }}
          >
            Start from Scratch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
