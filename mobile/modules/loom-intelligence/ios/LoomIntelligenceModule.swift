import ExpoModulesCore
import Vision
import UIKit
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Drafts day titles and stops for a trip with the on-device model (iOS 26+, Apple Intelligence on).
/// Returns JSON `{"days":[{"title":…,"stops":[{"time":"HH:MM","title":…,"category":…}]}]}`.
/// Dates, length, travellers and budget come from the app's own parser; the model only fills the days.
public class LoomIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoomIntelligence")

    AsyncFunction("isAvailable") { () -> Bool in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        if case .available = SystemLanguageModel.default.availability { return true }
      }
      #endif
      return false
    }

    // On-device text recognition (Vision), used to read receipts. Returns the lines top to bottom.
    AsyncFunction("recognizeText") { (uri: String) async throws -> [String] in
      guard let url = URL(string: uri), let data = try? Data(contentsOf: url), let image = UIImage(data: data), let cg = image.cgImage else {
        throw Exception(name: "BadImage", description: "Couldn’t read that photo.")
      }
      return try await withCheckedThrowingContinuation { continuation in
        let request = VNRecognizeTextRequest { request, error in
          if let error { continuation.resume(throwing: error); return }
          // Vision reads columns separately ("TOTAL" and "42,90"); rebuild each printed row, left to right.
          let found = (request.results as? [VNRecognizedTextObservation] ?? [])
            .compactMap { o in o.topCandidates(1).first.map { (box: o.boundingBox, text: $0.string) } }
            .sorted { $0.box.midY > $1.box.midY }
          var rows: [[(box: CGRect, text: String)]] = []
          for item in found {
            if let last = rows.last?.first, abs(last.box.midY - item.box.midY) < min(last.box.height, item.box.height) * 0.6 {
              rows[rows.count - 1].append(item)
            } else {
              rows.append([item])
            }
          }
          let lines = rows.map { $0.sorted { $0.box.minX < $1.box.minX }.map(\.text).joined(separator: "  ") }
          continuation.resume(returning: lines)
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        do { try VNImageRequestHandler(cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation), options: [:]).perform([request]) }
        catch { continuation.resume(throwing: error) }
      }
    }

    AsyncFunction("draftDays") { (prompt: String, destination: String, days: Int, kind: String) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await LoomDrafter.draft(prompt: prompt, destination: destination, days: days, kind: kind)
      }
      #endif
      throw Exception(name: "Unavailable", description: "On-device drafting needs iOS 26 with Apple Intelligence.")
    }
  }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct DraftStopModel {
  @Guide(description: "Start time in 24-hour HH:MM, for example 09:30")
  var time: String
  @Guide(description: "A short, specific plan, at most 8 words, naming a real place when you know one")
  var title: String
  @Guide(.anyOf(["Explore", "Food & drink", "Travel", "Stay", "Event", "Other"]))
  var category: String
}

@available(iOS 26.0, *)
@Generable
struct DraftDayModel {
  @Guide(description: "A short title for the day, at most 5 words")
  var title: String
  @Guide(description: "Two to four plans in time order", .count(2...4))
  var stops: [DraftStopModel]
}

@available(iOS 26.0, *)
@Generable
struct DraftPlanModel {
  var days: [DraftDayModel]
}

@available(iOS 26.0, *)
enum LoomDrafter {
  static func draft(prompt: String, destination: String, days: Int, kind: String) async throws -> String {
    let count = max(1, min(days, 21))
    let instructions = """
    You plan trips for Trips Loom. Write a realistic day-by-day plan for exactly \(count) days in \(destination).
    The trip style is \(kind). Day 1 is arrival and the last day is departure, so keep them light.
    Keep plans practical and well paced. Don't invent bookings, prices or opening hours. Use neutral, international English.
    """
    let session = LanguageModelSession(instructions: instructions)
    let request = String(prompt.prefix(600))
    let response = try await session.respond(to: "Traveller's request: \(request)", generating: DraftPlanModel.self)
    let plan = response.content
    let payload: [String: Any] = [
      "days": plan.days.prefix(count).map { day in
        [
          "title": String(day.title.prefix(120)),
          "stops": day.stops.prefix(5).map { stop in
            ["time": stop.time, "title": String(stop.title.prefix(120)), "category": stop.category]
          },
        ] as [String: Any]
      },
    ]
    let data = try JSONSerialization.data(withJSONObject: payload)
    return String(data: data, encoding: .utf8) ?? "{\"days\":[]}"
  }
}
#endif

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .down: self = .down
    case .left: self = .left
    case .right: self = .right
    case .upMirrored: self = .upMirrored
    case .downMirrored: self = .downMirrored
    case .leftMirrored: self = .leftMirrored
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
