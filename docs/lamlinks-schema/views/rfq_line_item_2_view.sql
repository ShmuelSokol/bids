-- dbo.rfq_line_item_2_view



/* view rfq_line_item_2_view: add view */


/* view rfq_line_item_2_view: add view */


/* view rfq_line_item_2_view: add view */

/* view rfq_line_item_2_view: add view */
/* view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view 
 view rfq_line_item_2_view: add view */
CREATE VIEW dbo.rfq_line_item_2_view
AS
SELECT DISTINCT 
                         dbo.rfq_2_query.idnk42_k42, dbo.rfq_line_item_1_view.e_name_k12, dbo.rfq_line_item_1_view.s_code_k39, dbo.rfq_line_item_1_view.rfq_no_k42, dbo.rfq_line_item_1_view.partno_k08, dbo.rfq_line_item_1_view.p_cage_k08, 
                         dbo.rfq_line_item_1_view.p_desc_k08, dbo.rfq_line_item_1_view.fsc_k08, dbo.rfq_line_item_1_view.niin_k08, dbo.sol_part_4_view.c_stat_kc4, dbo.rfq_line_item_1_view.rqpsta_k43, 
                         dbo.rfq_line_item_1_view.rqptme_k43
FROM            dbo.k46_tab INNER JOIN
                         dbo.rfq_2_query ON dbo.k46_tab.idncct_k46 = dbo.rfq_2_query.idnk42_k42 INNER JOIN
                         dbo.rfq_line_item_1_view ON dbo.rfq_2_query.idnk42_k42 = dbo.rfq_line_item_1_view.idnk42_k42 INNER JOIN
                         dbo.sol_part_4_view ON dbo.rfq_2_query.idnkc4_kc4 = dbo.sol_part_4_view.idnkc4_kc4
WHERE        (dbo.k46_tab.ccttyp_k46 = 'k42')




