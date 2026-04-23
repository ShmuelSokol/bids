-- dbo.rfq_line_item_1_view



/* view rfq_line_item_1_view: add view */


/* view rfq_line_item_1_view: add view */


/* view rfq_line_item_1_view: add view */

/* view rfq_line_item_1_view: add view */
/* view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view 
 view rfq_line_item_1_view: add view */
CREATE VIEW dbo.rfq_line_item_1_view
AS
SELECT        TOP (100) PERCENT K12_tab.e_name_k12, K39_tab.s_code_k39, K39_tab.s_attn_k39, K42_tab.rfq_no_k42, K08_tab.partno_k08, K08_tab.partrv_k08, K08_tab.p_cage_k08, K08_tab.p_desc_k08, K08_tab.fsc_k08, 
                         K08_tab.niin_k08, K08_tab.p_um_k08, K40_tab.spnnum_k40, K40_tab.spncge_k40, K40_tab.enauto_k40, K42_tab.r_note_k42, K42_tab.c_note_k42, K43_tab.itemno_k43, K43_tab.p_note_k43, K43_tab.c_note_k43, 
                         K08_tab.idnk08_k08, K12_tab.idnk12_k12, K39_tab.idnk39_k39, K39_tab.idnk36_k39, K36_tab.idnk36_k36, K40_tab.idnk40_k40, K42_tab.idnk42_k42, K43_tab.idnk43_k43, K36_tab.email_k36, K42_tab.uptime_k42, 
                         K42_tab.addtme_k42, K42_tab.rfquno_k42, K43_tab.rqpsta_k43, K43_tab.rqptme_k43, K42_tab.rrqsta_k42, K42_tab.itmcnt_k42
FROM            dbo.k43_tab AS K43_tab INNER JOIN
                         dbo.k42_tab AS K42_tab ON K43_tab.idnk42_k43 = K42_tab.idnk42_k42 INNER JOIN
                         dbo.k39_tab AS K39_tab ON K42_tab.idnk39_k42 = K39_tab.idnk39_k39 INNER JOIN
                         dbo.k12_tab AS K12_tab ON K39_tab.idnk12_k39 = K12_tab.idnk12_k12 INNER JOIN
                         dbo.k40_tab AS K40_tab ON K43_tab.idnk40_k43 = K40_tab.idnk40_k40 INNER JOIN
                         dbo.k08_tab AS K08_tab ON K40_tab.idnk08_k40 = K08_tab.idnk08_k08 INNER JOIN
                         dbo.k41_tab AS K41_tab ON K42_tab.idnk41_k42 = K41_tab.idnk41_k41 INNER JOIN
                         dbo.k36_tab AS K36_tab ON K41_tab.idnk36_k41 = K36_tab.idnk36_k36




