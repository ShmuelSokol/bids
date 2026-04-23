-- dbo.sol_rfq_line_item_1_view



/* view sol_rfq_line_item_1_view: add view */


/* view sol_rfq_line_item_1_view: add view */


/* view sol_rfq_line_item_1_view: add view */

/* view sol_rfq_line_item_1_view: add view */


/* view sol_rfq_line_item_1_view: add view */
CREATE VIEW dbo.sol_rfq_line_item_1_view
AS
SELECT        dbo.sol_rfq_1_view.sol_no_k10, dbo.rfq_line_item_1_view.idnk42_k42, dbo.rfq_line_item_1_view.idnk43_k43, dbo.rfq_line_item_1_view.rfq_no_k42, dbo.rfq_line_item_1_view.uptime_k42, 
                         dbo.rfq_line_item_1_view.partno_k08, dbo.rfq_line_item_1_view.p_cage_k08, dbo.rfq_line_item_1_view.p_desc_k08, dbo.rfq_line_item_1_view.fsc_k08, dbo.rfq_line_item_1_view.niin_k08, 
                         dbo.rfq_line_item_1_view.spnnum_k40, dbo.rfq_line_item_1_view.spncge_k40, dbo.rfq_line_item_1_view.itemno_k43, dbo.rfq_line_item_1_view.e_name_k12, dbo.rfq_line_item_1_view.s_code_k39, 
                         dbo.rfq_line_item_1_view.s_attn_k39, dbo.sol_rfq_1_view.ref_no_k09
FROM            dbo.sol_rfq_1_view INNER JOIN
                         dbo.rfq_line_item_1_view ON dbo.sol_rfq_1_view.idnk43_k43 = dbo.rfq_line_item_1_view.idnk43_k43





