from datetime import datetime, timezone
from typing import Optional, Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import bad_gateway, unprocessable_entity
from app.models.day5_schemas import AdvisoryAskRequest, AdvisoryAskResponse
from app.models.engine_schemas import ExplanationPayload
from app.services.context_compiler_service import ContextCompilerService
from app.services.input_window_optimizer_service import InputWindowOptimizerService


class AdvisoryService:
    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        gemini_client: Optional[Any] = None,
    ) -> None:
        self.db = db
        self.context_compiler = ContextCompilerService(db)
        self.optimizer = InputWindowOptimizerService(db)

    async def ask(self, user_id: str, payload: AdvisoryAskRequest, language: str) -> AdvisoryAskResponse:
        query = payload.query.strip()
        if not query:
            raise unprocessable_entity("Query is required")

        # Compile baseline context
        compiled = await self.context_compiler.compile_context(
            user_id=user_id,
            farm_id=payload.farm_id,
            query=query,
            language=language,
        )

        # Get core intelligence and weather details
        field_context = await self.context_compiler.stress_service.build_field_context(payload.farm_id, user_id)
        core = await self.context_compiler._build_core_intelligence(user_id, payload.farm_id)
        
        weather = field_context.weather
        
        # 1. Intent Classification (Bilingual Compound Intent Matching)
        query_lower = query.lower()
        matched_intents = []
        
        intent_keywords = {
            "IRRIGATION": ["irrigate", "water", "dry", "wilt", "watering", "सिंचाई", "पानी", "सूखा", "मुरझा", "नमी"],
            "FERTILIZER": ["fertilizer", "urea", "npk", "nitrogen", "potash", "phosphorus", "fertilize", "खाद", "यूरिया", "नाइट्रोजन", "मिट्टी"],
            "SPRAY": ["spray", "pest", "bug", "insecticide", "pesticide", "neem", "insect", "aphid", "छिड़काव", "कीटनाशक", "नीम", "कीट", "कीड़े"],
            "DISEASE": ["disease", "rust", "blight", "spots", "lesions", "mildew", "infection", "रोग", "बीमारी", "धब्बे", "गेरूआ", "पीला"],
            "WEATHER": ["weather", "forecast", "temp", "rain", "precipitation", "wind", "gdd", "मौसम", "तापमान", "बारिश", "हवा"],
            "MARKET": ["market", "mandi", "price", "rates", "modal", "sell", "मंडी", "भाव", "बाजार", "दाम"],
            "SCHEMES": ["scheme", "government", "yojana", "subsidy", "eligible", "योजना", "सब्सिडी", "सरकारी"],
            "YIELD_RISK": ["yield", "risk", "loss", "estimate", "उपज", "नुकसान", "जोखिम", "अनुमानित"],
            "HEALTH": ["health", "overall", "wellbeing", "status", "farm status", "आरोग्य", "स्वास्थ्य", "हाल", "स्थिति"]
        }
        
        for intent, keywords in intent_keywords.items():
            if any(kw in query_lower for kw in keywords):
                matched_intents.append(intent)
                
        if not matched_intents:
            matched_intents.append("HEALTH")

        # 2. Gather Recommendations and Evidence ("Why" blocks)
        synthesis_parts = []
        evidence_lines = []
        
        lang = language.lower() if language in ["hi", "en"] else "hi"

        # Check for active alerts
        unread_alerts = await self.context_compiler._count_unread_alerts(user_id, payload.farm_id)

        # Iterate matched intents
        for intent in matched_intents:
            if intent == "IRRIGATION":
                resp = await self.optimizer.evaluate(user_id, payload.farm_id, "IRRIGATE")
                forecast_rain = sum(day.precipitation for day in weather.forecast[:3])
                if lang == "hi":
                    status = "सुरक्षित है" if resp.safe else "असुरक्षित है"
                    synthesis_parts.append(f"सिंचाई सलाह: आपके खेत में अभी सिंचाई करना {status}।")
                    if resp.reasons:
                        synthesis_parts.append(f"सिंचाई न करने का कारण: {', '.join(resp.reasons)}।")
                    evidence_lines.append("• [सिंचाई] खेत का तनाव सूचकांक (FSI): " + str(core.fsi))
                    evidence_lines.append("• [सिंचाई] 3-दिवसीय वर्षा पूर्वानुमान: " + str(forecast_rain) + " मिमी")
                    evidence_lines.append("• [सिंचाई] सुरक्षित झरोखा स्थिति: " + ("हाँ" if resp.safe else "नहीं"))
                else:
                    status = "recommended" if resp.safe else "not recommended"
                    synthesis_parts.append(f"Irrigation Advisory: Watering is {status} for your field.")
                    if resp.reasons:
                        synthesis_parts.append(f"Irrigation restriction reasons: {', '.join(resp.reasons)}.")
                    evidence_lines.append(f"• [Irrigation] Field Stress Index (FSI): {core.fsi}")
                    evidence_lines.append(f"• [Irrigation] 3-day precipitation forecast: {forecast_rain} mm")
                    evidence_lines.append(f"• [Irrigation] Safety window status: {'Safe' if resp.safe else 'Unsafe'}")

            elif intent == "FERTILIZER":
                resp = await self.optimizer.evaluate(user_id, payload.farm_id, "FERTILIZE")
                soil_section, soil_data = await self.context_compiler._build_soil_section(payload.farm_id)
                n_status = "OPTIMAL"
                p_status = "OPTIMAL"
                k_status = "OPTIMAL"
                shi = 100.0
                
                if soil_data:
                    deficiency = soil_data.get("deficiency_status", {})
                    n_status = deficiency.get("nitrogen", "OPTIMAL")
                    p_status = deficiency.get("phosphorus", "OPTIMAL")
                    k_status = deficiency.get("potassium", "OPTIMAL")
                    shi = soil_data.get("soil_health_index", 100.0)
                
                if lang == "hi":
                    status = "सुरक्षित है" if resp.safe else "असुरक्षित है"
                    synthesis_parts.append(f"खाद सलाह: उर्वरक/खाद डालना अभी {status}।")
                    if n_status == "DEFICIENT":
                        synthesis_parts.append("नाइट्रोजन (N) की कमी पाई गई है; यूरिया डालने पर विचार करें।")
                    if p_status == "DEFICIENT":
                        synthesis_parts.append("फॉस्फोरस (P) की कमी पाई गई है; डीएपी (DAP) का प्रयोग करें।")
                    if k_status == "DEFICIENT":
                        synthesis_parts.append("पोटेशियम (K) की कमी पाई गई है; एमओपी (MOP) का छिड़काव करें।")
                    if n_status != "DEFICIENT" and p_status != "DEFICIENT" and k_status != "DEFICIENT":
                        synthesis_parts.append("सभी मुख्य मिट्टी पोषक तत्व पर्याप्त स्तर पर हैं।")
                        
                    evidence_lines.append("• [उर्वरक] मिट्टी स्वास्थ्य सूचकांक: " + str(shi))
                    evidence_lines.append(f"• [उर्वरक] एनपीके स्थिति: N={n_status}, P={p_status}, K={k_status}")
                    evidence_lines.append("• [उर्वरक] सुरक्षा विंडो: " + ("हाँ" if resp.safe else "नहीं"))
                else:
                    status = "recommended" if resp.safe else "not recommended"
                    synthesis_parts.append(f"Fertilizer Advisory: Fertilizer application is {status}.")
                    if n_status == "DEFICIENT":
                        synthesis_parts.append("Nitrogen deficiency detected; urea application is recommended.")
                    if p_status == "DEFICIENT":
                        synthesis_parts.append("Phosphorus deficiency detected; consider applying DAP.")
                    if k_status == "DEFICIENT":
                        synthesis_parts.append("Potassium deficiency detected; consider applying MOP.")
                    if n_status != "DEFICIENT" and p_status != "DEFICIENT" and k_status != "DEFICIENT":
                        synthesis_parts.append("All key soil macronutrients are within optimal ranges.")
                        
                    evidence_lines.append(f"• [Fertilizer] Soil Health Index: {shi}")
                    evidence_lines.append(f"• [Fertilizer] NPK Status: N={n_status}, P={p_status}, K={k_status}")
                    evidence_lines.append(f"• [Fertilizer] Application window: {'Safe' if resp.safe else 'Unsafe'}")

            elif intent == "SPRAY":
                resp = await self.optimizer.evaluate(user_id, payload.farm_id, "SPRAY")
                if lang == "hi":
                    status = "अनुकूल है" if resp.safe else "अनुकूल नहीं है"
                    synthesis_parts.append(f"छिड़काव सलाह: दवाओं/कीटनाशकों के छिड़काव के लिए मौसम {status}।")
                    if resp.reasons:
                        synthesis_parts.append(f"कारण: {', '.join(resp.reasons)}।")
                    evidence_lines.append("• [छिड़काव] वर्तमान हवा की गति: " + str(weather.current.wind_speed) + " किमी/घंटा")
                    evidence_lines.append("• [छिड़काव] छिड़काव सुरक्षा विंडो: " + ("हाँ" if resp.safe else "नहीं"))
                else:
                    status = "safe" if resp.safe else "unsafe"
                    synthesis_parts.append(f"Spray Advisory: Current conditions are {status} for chemical applications.")
                    if resp.reasons:
                        synthesis_parts.append(f"Details: {', '.join(resp.reasons)}.")
                    evidence_lines.append(f"• [Spray] Wind Speed: {weather.current.wind_speed} km/h")
                    evidence_lines.append(f"• [Spray] Safety status: {'Safe' if resp.safe else 'Unsafe'}")

            elif intent == "DISEASE":
                disease_present = core.disease_present
                radar_high_nearby, radar_high_count = await self.context_compiler._radar_high_nearby(user_id, payload.farm_id, core.crop_type)
                
                # Fetch recent confirmed disease
                cursor = self.db.disease_reports.find({"farm_id": ObjectId(payload.farm_id)}).sort("created_at", -1).limit(1)
                latest_report = None
                async for r in cursor:
                    latest_report = r
                
                disease_name = "सक्रिय रोग" if lang == "hi" else "active disease"
                if latest_report:
                    disease_name = latest_report.get("detected_disease", disease_name)
                
                if lang == "hi":
                    if disease_present:
                        synthesis_parts.append(f"रोग चेतावनी: खेत में {disease_name} संक्रमण की पुष्टि हुई है।")
                    else:
                        synthesis_parts.append("रोग स्थिति: खेत में वर्तमान में कोई सक्रिय संक्रमण नहीं पाया गया है।")
                    if radar_high_nearby:
                        synthesis_parts.append(f"रडार चेतावनी: आस-पास के क्षेत्रों में {radar_high_count} उच्च-जोखिम हॉटस्पॉट सक्रिय हैं।")
                    evidence_lines.append("• [रोग] संक्रमण सक्रिय: " + ("हाँ" if disease_present else "नहीं"))
                    evidence_lines.append("• [रोग] निकटतम उच्च-जोखिम हॉटस्पॉट: " + str(radar_high_count))
                else:
                    if disease_present:
                        synthesis_parts.append(f"Disease Warning: Active infection of {disease_name} is confirmed on the farm.")
                    else:
                        synthesis_parts.append("Disease Status: No active disease infection detected on your farm.")
                    if radar_high_nearby:
                        synthesis_parts.append(f"Radar Alert: {radar_high_count} high-risk disease outbreaks reported nearby.")
                    evidence_lines.append(f"• [Disease] Active infection: {'Yes' if disease_present else 'No'}")
                    evidence_lines.append(f"• [Disease] High-risk nearby outbreaks: {radar_high_count}")

            elif intent == "WEATHER":
                if lang == "hi":
                    synthesis_parts.append(f"मौसम विवरण: वर्तमान तापमान {weather.current.temp}°C और आर्द्रता {weather.current.humidity}% है।")
                    evidence_lines.append("• [मौसम] हवा की गति: " + str(weather.current.wind_speed) + " किमी/घंटा")
                    evidence_lines.append("• [मौसम] संचित जीडीडी (GDD): " + str(core.current_gdd))
                else:
                    synthesis_parts.append(f"Weather Outlook: Current temperature is {weather.current.temp}°C with humidity at {weather.current.humidity}%.")
                    evidence_lines.append(f"• [Weather] Wind speed: {weather.current.wind_speed} km/h")
                    evidence_lines.append(f"• [Weather] Accumulated GDD: {core.current_gdd}")

            elif intent == "MARKET":
                market_summary = await self.context_compiler.market_service.get_summary_for_farm(user_id, payload.farm_id)
                if lang == "hi":
                    if market_summary:
                        synthesis_parts.append(f"बाज़ार मूल्य: {market_summary.get('crop_type', core.crop_type)} का मॉडल मूल्य मण्डी {market_summary.get('mandi', 'स्थानीय')} में ₹{market_summary.get('modal_price')}/क्विंटल है। रुझान: {market_summary.get('trend', 'स्थिर')}।")
                    else:
                        synthesis_parts.append("बाज़ार विवरण: अभी मंडी मूल्य विवरण उपलब्ध नहीं है।")
                    evidence_lines.append("• [मंडी] मंडी स्रोत: " + (market_summary.get('mandi') if market_summary else "अनुपलब्ध"))
                else:
                    if market_summary:
                        synthesis_parts.append(f"Market Prices: Modal price for {market_summary.get('crop_type', core.crop_type)} at {market_summary.get('mandi', 'Local')} is ₹{market_summary.get('modal_price')}/quintal. Trend is {market_summary.get('trend', 'STABLE')}.")
                    else:
                        synthesis_parts.append("Market Prices: Mandi price trend data is currently unavailable.")
                    evidence_lines.append(f"• [Market] Mandi Source: {market_summary.get('mandi') if market_summary else 'N/A'}")

            elif intent == "SCHEMES":
                schemes_data = await self.context_compiler.scheme_service.get_eligible(user_id, payload.farm_id)
                count = len(schemes_data.schemes) if schemes_data else 0
                if lang == "hi":
                    synthesis_parts.append(f"कृषि योजनाएं: आप {count} सरकारी सहायता/सब्सिडी योजनाओं के लिए पात्र हैं।")
                    if count > 0:
                        synthesis_parts.append(f"अनुशंसित: {schemes_data.schemes[0].name}।")
                    evidence_lines.append("• [योजनाएं] कुल पात्र सरकारी योजनाएं: " + str(count))
                else:
                    synthesis_parts.append(f"Government Schemes: You are eligible for {count} government schemes.")
                    if count > 0:
                        synthesis_parts.append(f"Recommended scheme: {schemes_data.schemes[0].name}.")
                    evidence_lines.append(f"• [Schemes] Eligible matched schemes: {count}")

            elif intent == "YIELD_RISK":
                pct = core.yield_risk.estimated_risk_percent
                band = core.yield_risk.risk_band
                factors = ", ".join(core.yield_risk.contributing_factors)
                if lang == "hi":
                    synthesis_parts.append(f"उपज जोखिम: आपके वर्तमान चक्र में जोखिम का स्तर '{band}' है। संभावित नुकसान का अनुमान {pct}% है।")
                    evidence_lines.append("• [जोखिम] मुख्य योगदान कारक: " + factors)
                else:
                    synthesis_parts.append(f"Yield Risk: Yield risk level is currently classified as '{band}' with a projected loss of {pct}%.")
                    evidence_lines.append(f"• [Risk] Key contributing factors: {factors}")

            elif intent == "HEALTH":
                health_snapshot = await self.context_compiler.compile_health_snapshot(user_id, payload.farm_id, language=language)
                band = health_snapshot.health_band
                score = health_snapshot.health_score
                if lang == "hi":
                    synthesis_parts.append(f"खेत स्वास्थ्य: आपके खेत का समग्र स्वास्थ्य वर्गीकरण '{band}' है (स्वास्थ्य स्कोर: {score}/100)।")
                    evidence_lines.append("• [स्वास्थ्य] सक्रिय अपठित चेतावनियां: " + str(unread_alerts))
                    evidence_lines.append("• [स्वास्थ्य] क्षेत्र तनाव सूचकांक (FSI): " + str(core.fsi))
                else:
                    synthesis_parts.append(f"Farm Health: Overall farm health status is classified as '{band}' (health score: {score}/100).")
                    evidence_lines.append(f"• [Health] Active unread alerts: {unread_alerts}")
                    evidence_lines.append(f"• [Health] Field Stress Index (FSI): {core.fsi}")

        # Combine synthesis parts and evidence
        synthesis = " ".join(synthesis_parts)
        if evidence_lines:
            why_header = "\n\nWhy / साक्ष्य:\n" if lang == "hi" else "\n\nWhy / Evidence:\n"
            synthesis += why_header + "\n".join(evidence_lines)

        # 3. Compute Categorical Confidence (HIGH / MEDIUM / LOW)
        if core.soil_health_index is not None and unread_alerts <= 2:
            confidence = "HIGH"
        elif core.soil_health_index is not None:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        # 4. Persistence Logging
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": ObjectId(user_id),
            "farm_id": ObjectId(payload.farm_id),
            "query": query,
            "language": language,
            "context_package": compiled.context_package,
            "context_hash": compiled.context_hash,
            "synthesis": synthesis,
            "citations": [],
            "explainability": {
                "summary": f"Deterministic rule resolution (Matched: {', '.join(matched_intents)}).",
                "inputs": {
                    **compiled.explainability.get("inputs", {}),
                    "confidence_level": confidence,
                    "matched_intents": matched_intents,
                },
                "primary_factor": core.primary_factor,
            },
            "rag_chunk_ids": compiled.rag_chunk_ids,
            "intelligence_snapshot_version": compiled.intelligence_snapshot_version,
            "created_at": now,
        }
        result = await self.db.advisory_logs.insert_one(doc)

        return AdvisoryAskResponse(
            advisory_id=str(result.inserted_id),
            farm_id=payload.farm_id,
            synthesis=synthesis,
            advisory_text=synthesis,
            language=language,
            explainability=ExplanationPayload(
                summary=doc["explainability"]["summary"],
                inputs=doc["explainability"]["inputs"],
                primary_factor=doc["explainability"]["primary_factor"]
            ),
            explanation=doc["explainability"],
            citations=[],
            intelligence_snapshot_version=compiled.intelligence_snapshot_version,
        )
