#!/usr/bin/env python3
"""
Backend API Test Suite for SimAI Life Simulator
Tests all backend endpoints with realistic data
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Use the public backend URL
BASE_URL = "https://sims-ai-sandbox.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def validate_json(response: requests.Response) -> bool:
    """Validate that response is valid JSON without ObjectId errors"""
    try:
        data = response.json()
        # Check if response contains any ObjectId strings that weren't converted
        json_str = json.dumps(data)
        if "ObjectId" in json_str:
            print_error("Response contains unconverted ObjectId")
            return False
        return True
    except json.JSONDecodeError as e:
        print_error(f"Invalid JSON response: {e}")
        return False

def test_health() -> bool:
    """Test GET /api/health"""
    print_test("GET /api/health - Health check endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False
        
        if not validate_json(response):
            return False
        
        data = response.json()
        if data.get("status") != "healthy":
            print_error(f"Expected status 'healthy', got {data.get('status')}")
            return False
        
        print_success("Health check passed")
        print(f"Response: {json.dumps(data, indent=2)}")
        return True
        
    except Exception as e:
        print_error(f"Health check failed: {e}")
        return False

def test_characters() -> tuple[bool, List[Dict]]:
    """Test GET /api/characters"""
    print_test("GET /api/characters - List all characters")
    
    try:
        response = requests.get(f"{BASE_URL}/characters", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False, []
        
        if not validate_json(response):
            return False, []
        
        characters = response.json()
        
        # Validate we have 3 characters
        if len(characters) != 3:
            print_error(f"Expected 3 characters, got {len(characters)}")
            return False, []
        
        # Validate character names
        expected_names = ["Sophie Laurent", "Kenji Tanaka", "Marcus Johnson"]
        actual_names = [c.get("name") for c in characters]
        
        for name in expected_names:
            if name not in actual_names:
                print_error(f"Expected character '{name}' not found")
                return False, []
        
        # Validate character structure
        for char in characters:
            # Check required fields
            required_fields = ["id", "name", "age", "occupation", "bio", "location_id", "needs", "personality"]
            for field in required_fields:
                if field not in char:
                    print_error(f"Character missing required field: {field}")
                    return False, []
            
            # Validate needs structure
            needs = char.get("needs", {})
            required_needs = ["hunger", "energy", "social", "hygiene", "fun", "bladder", "comfort"]
            for need in required_needs:
                if need not in needs:
                    print_error(f"Character needs missing field: {need}")
                    return False, []
                
                # Validate need values are between 0 and 100
                value = needs[need]
                if not (0 <= value <= 100):
                    print_error(f"Need '{need}' value {value} out of range [0, 100]")
                    return False, []
            
            # Validate personality structure
            personality = char.get("personality", {})
            required_personality = ["extroversion", "creativity", "ambition", "kindness", "humor"]
            for trait in required_personality:
                if trait not in personality:
                    print_error(f"Character personality missing field: {trait}")
                    return False, []
        
        print_success(f"Found {len(characters)} characters with proper structure")
        for char in characters:
            print(f"  - {char['name']} ({char['occupation']}) at {char['location_id']}")
            print(f"    Needs: hunger={char['needs']['hunger']:.1f}, energy={char['needs']['energy']:.1f}, social={char['needs']['social']:.1f}")
        
        return True, characters
        
    except Exception as e:
        print_error(f"Characters test failed: {e}")
        return False, []

def test_locations() -> tuple[bool, List[Dict]]:
    """Test GET /api/locations"""
    print_test("GET /api/locations - List all world locations")
    
    try:
        response = requests.get(f"{BASE_URL}/locations", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False, []
        
        if not validate_json(response):
            return False, []
        
        locations = response.json()
        
        # Validate we have 8 locations
        if len(locations) != 8:
            print_error(f"Expected 8 locations, got {len(locations)}")
            return False, []
        
        # Validate location IDs
        expected_ids = ["paris_cafe", "tokyo_apartment", "nyc_office", "london_park", 
                       "barcelona_gym", "rome_restaurant", "berlin_club", "sydney_beach"]
        actual_ids = [loc.get("id") for loc in locations]
        
        for loc_id in expected_ids:
            if loc_id not in actual_ids:
                print_error(f"Expected location '{loc_id}' not found")
                return False, []
        
        # Validate location structure
        for loc in locations:
            required_fields = ["id", "name", "description", "type", "city", "country", "emoji", "available_actions"]
            for field in required_fields:
                if field not in loc:
                    print_error(f"Location missing required field: {field}")
                    return False, []
            
            # Validate available_actions is a list
            if not isinstance(loc.get("available_actions"), list):
                print_error(f"Location available_actions should be a list")
                return False, []
        
        print_success(f"Found {len(locations)} locations with proper structure")
        for loc in locations:
            print(f"  - {loc['name']} ({loc['city']}, {loc['country']}) - {loc['type']}")
        
        return True, locations
        
    except Exception as e:
        print_error(f"Locations test failed: {e}")
        return False, []

def test_world() -> bool:
    """Test GET /api/world"""
    print_test("GET /api/world - Get world state")
    
    try:
        response = requests.get(f"{BASE_URL}/world", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False
        
        if not validate_json(response):
            return False
        
        world = response.json()
        
        # Validate world structure
        required_fields = ["game_time", "is_paused", "current_weather"]
        for field in required_fields:
            if field not in world:
                print_error(f"World state missing required field: {field}")
                return False
        
        # Validate is_paused is boolean
        if not isinstance(world.get("is_paused"), bool):
            print_error(f"is_paused should be boolean, got {type(world.get('is_paused'))}")
            return False
        
        print_success("World state retrieved successfully")
        print(f"  Game time: {world.get('game_time')}")
        print(f"  Paused: {world.get('is_paused')}")
        print(f"  Weather: {world.get('current_weather')}")
        
        return True
        
    except Exception as e:
        print_error(f"World state test failed: {e}")
        return False

def test_simulate() -> bool:
    """Test POST /api/simulate"""
    print_test("POST /api/simulate - AI simulation tick")
    
    try:
        response = requests.post(f"{BASE_URL}/simulate", timeout=60)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        if not validate_json(response):
            return False
        
        data = response.json()
        
        # Validate response structure
        if "status" not in data:
            print_error("Response missing 'status' field")
            return False
        
        if data["status"] == "paused":
            print_warning("Simulation is paused")
            return True
        
        if "results" not in data:
            print_error("Response missing 'results' field")
            return False
        
        results = data["results"]
        
        # Validate we have results for all 3 characters
        if len(results) != 3:
            print_error(f"Expected results for 3 characters, got {len(results)}")
            return False
        
        # Validate each result has required fields
        for result in results:
            required_fields = ["character_id", "name", "action", "thought", "mood", "location"]
            for field in required_fields:
                if field not in result:
                    print_error(f"Result missing required field: {field}")
                    return False
            
            # Validate thought is not empty (AI-generated)
            if not result.get("thought") or result.get("thought") == "":
                print_error(f"Character {result['name']} has empty thought (AI should generate thoughts)")
                return False
        
        print_success("Simulation tick completed successfully")
        print("AI-generated actions and thoughts:")
        for result in results:
            print(f"  - {result['name']}: {result['action']}")
            print(f"    Thought: \"{result['thought']}\"")
            print(f"    Mood: {result['mood']}, Location: {result['location']}")
        
        return True
        
    except Exception as e:
        print_error(f"Simulate test failed: {e}")
        return False

def test_move_character(characters: List[Dict]) -> bool:
    """Test POST /api/characters/{id}/move"""
    print_test("POST /api/characters/char_1/move - Move character")
    
    if not characters:
        print_error("No characters available for testing")
        return False
    
    try:
        # Move Sophie (char_1) to Barcelona gym
        response = requests.post(
            f"{BASE_URL}/characters/char_1/move",
            params={"location_id": "barcelona_gym"},
            timeout=10
        )
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        if not validate_json(response):
            return False
        
        data = response.json()
        
        # Validate response
        if data.get("status") != "success":
            print_error(f"Expected status 'success', got {data.get('status')}")
            return False
        
        if data.get("location") != "barcelona_gym":
            print_error(f"Expected location 'barcelona_gym', got {data.get('location')}")
            return False
        
        # Verify the character actually moved
        char_response = requests.get(f"{BASE_URL}/characters/char_1", timeout=10)
        if char_response.status_code == 200:
            char_data = char_response.json()
            if char_data.get("location_id") != "barcelona_gym":
                print_error(f"Character location not updated. Expected 'barcelona_gym', got {char_data.get('location_id')}")
                return False
        
        print_success("Character moved successfully to Barcelona gym")
        print(f"Response: {json.dumps(data, indent=2)}")
        
        return True
        
    except Exception as e:
        print_error(f"Move character test failed: {e}")
        return False

def test_logs() -> bool:
    """Test GET /api/logs"""
    print_test("GET /api/logs?limit=5 - Activity logs")
    
    try:
        response = requests.get(f"{BASE_URL}/logs", params={"limit": 5}, timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False
        
        if not validate_json(response):
            return False
        
        logs = response.json()
        
        # Validate logs is a list
        if not isinstance(logs, list):
            print_error(f"Expected list of logs, got {type(logs)}")
            return False
        
        # If we have logs, validate structure
        if len(logs) > 0:
            for log in logs[:5]:  # Check first 5
                required_fields = ["character_id", "character_name", "action", "location", "timestamp"]
                for field in required_fields:
                    if field not in log:
                        print_error(f"Log missing required field: {field}")
                        return False
            
            print_success(f"Retrieved {len(logs)} activity logs")
            print("Recent activities:")
            for log in logs[:5]:
                print(f"  - {log['character_name']}: {log['action']} at {log['location']}")
                if "thought" in log and log["thought"]:
                    print(f"    Thought: \"{log['thought']}\"")
        else:
            print_warning("No logs found (this is OK for a fresh game)")
        
        return True
        
    except Exception as e:
        print_error(f"Logs test failed: {e}")
        return False

def test_pause() -> bool:
    """Test POST /api/world/pause"""
    print_test("POST /api/world/pause - Toggle pause state")
    
    try:
        # Get initial pause state
        world_response = requests.get(f"{BASE_URL}/world", timeout=10)
        if world_response.status_code != 200:
            print_error("Failed to get initial world state")
            return False
        
        initial_state = world_response.json()
        initial_paused = initial_state.get("is_paused", False)
        
        # Toggle pause
        response = requests.post(f"{BASE_URL}/world/pause", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False
        
        if not validate_json(response):
            return False
        
        data = response.json()
        
        # Validate response has is_paused field
        if "is_paused" not in data:
            print_error("Response missing 'is_paused' field")
            return False
        
        new_paused = data.get("is_paused")
        
        # Validate pause state changed
        if new_paused == initial_paused:
            print_error(f"Pause state did not toggle (still {initial_paused})")
            return False
        
        print_success(f"Pause state toggled: {initial_paused} → {new_paused}")
        
        # Toggle back to original state
        requests.post(f"{BASE_URL}/world/pause", timeout=10)
        
        return True
        
    except Exception as e:
        print_error(f"Pause test failed: {e}")
        return False

def test_reset() -> bool:
    """Test POST /api/reset"""
    print_test("POST /api/reset - Reset game to initial state")
    
    try:
        response = requests.post(f"{BASE_URL}/reset", timeout=10)
        
        if response.status_code != 200:
            print_error(f"Expected status 200, got {response.status_code}")
            return False
        
        if not validate_json(response):
            return False
        
        data = response.json()
        
        # Validate response
        if data.get("status") != "success":
            print_error(f"Expected status 'success', got {data.get('status')}")
            return False
        
        # Verify reset by checking characters are back to initial state
        char_response = requests.get(f"{BASE_URL}/characters", timeout=10)
        if char_response.status_code == 200:
            characters = char_response.json()
            if len(characters) != 3:
                print_error(f"After reset, expected 3 characters, got {len(characters)}")
                return False
        
        print_success("Game reset successfully")
        print(f"Response: {json.dumps(data, indent=2)}")
        
        return True
        
    except Exception as e:
        print_error(f"Reset test failed: {e}")
        return False

def main():
    """Run all backend tests"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}SimAI Life Simulator - Backend API Test Suite{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    results = {}
    
    # Test 1: Health check
    results["health"] = test_health()
    
    # Test 2: Characters
    success, characters = test_characters()
    results["characters"] = success
    
    # Test 3: Locations
    success, locations = test_locations()
    results["locations"] = success
    
    # Test 4: World state
    results["world"] = test_world()
    
    # Test 5: Simulate (AI decision making)
    results["simulate"] = test_simulate()
    
    # Test 6: Move character
    results["move"] = test_move_character(characters)
    
    # Test 7: Activity logs
    results["logs"] = test_logs()
    
    # Test 8: Pause toggle
    results["pause"] = test_pause()
    
    # Test 9: Reset game
    results["reset"] = test_reset()
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = f"{Colors.GREEN}PASSED{Colors.END}" if passed_test else f"{Colors.RED}FAILED{Colors.END}"
        print(f"{test_name.ljust(20)}: {status}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}✓ All tests passed!{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.RED}✗ Some tests failed{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
