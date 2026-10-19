Pod::Spec.new do |s|
  s.name           = 'LoomIntelligence'
  s.version        = '1.0.0'
  s.summary        = 'On-device trip drafting with Apple Foundation Models'
  s.description    = 'Drafts day-by-day trip plans on device on iOS 26 and later.'
  s.author         = 'Trips Loom'
  s.homepage       = 'https://tripsloom.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Weak so the app still launches on iOS versions without Foundation Models.
  s.weak_frameworks = 'FoundationModels'
  s.frameworks = 'Vision', 'PDFKit', 'MapKit'
  s.source_files   = '**/*.swift'
  s.swift_version  = '5.9'
end
