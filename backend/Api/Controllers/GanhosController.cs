using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Api.Services;
using Api.Models;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Requer autenticação para todos os endpoints
public class GanhosController : ControllerBase
{
    private readonly GanhoService _ganhoService;
    
    public GanhosController(GanhoService ganhoService)
    {
        _ganhoService = ganhoService;
    }
    
    private int GetUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    }
    
    [HttpGet]
    public async Task<IActionResult> GetMeusGanhos()
    {
        var ganhos = await _ganhoService.GetByUserAsync(GetUserId());
        return Ok(ganhos);
    }
    
    [HttpPost]
    public async Task<IActionResult> CreateGanho(Ganho ganho)
    {
        ganho.UserId = GetUserId();
        var result = await _ganhoService.CreateAsync(ganho);
        return Ok(result);
    }
    
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateGanho(int id, Ganho ganho)
    {
        // Verificar se o ganho pertence ao usuário
        var existing = await _ganhoService.GetByIdAsync(id);
        if (existing == null || existing.UserId != GetUserId())
            return NotFound();
            
        ganho.Id = id;
        ganho.UserId = GetUserId();
        var result = await _ganhoService.UpdateAsync(ganho);
        return Ok(result);
    }
    
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGanho(int id)
    {
        var existing = await _ganhoService.GetByIdAsync(id);
        if (existing == null || existing.UserId != GetUserId())
            return NotFound();
            
        await _ganhoService.DeleteAsync(id);
        return NoContent();
    }
}