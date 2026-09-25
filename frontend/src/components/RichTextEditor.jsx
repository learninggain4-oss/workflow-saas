import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Quill ന്റെ സ്റ്റാൻഡേർഡ് തീം

export default function RichTextEditor({ value, onChange, readOnly, placeholder, className }) {
  // ബോൾഡ്, ഇറ്റാലിക്, ലിങ്ക്, ടേബിൾ തുടങ്ങിയവയ്ക്കുള്ള മോഡ്യൂളുകൾ
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      [{ 'table': [] }], // ടേബിൾ സപ്പോർട്ട്
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image',
    'table'
  ];

  return (
    <div className={`rich-text-container ${className || ''}`}>
      <ReactQuill 
        theme="snow" 
        value={value || ''} 
        onChange={onChange} 
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder || "Add detailed description here..."}
      />
    </div>
  );
}