-- dbo.vendor_quote_2_view



/* view vendor_quote_2_view: add view */


/* view vendor_quote_2_view: add view */


/* view vendor_quote_2_view: add view */

/* view vendor_quote_2_view: add view */
/* view vendor_quote_2_view: add view */
CREATE VIEW dbo.vendor_quote_2_view
AS
SELECT        dbo.rfq_line_item_1_view.rfq_no_k42, dbo.rfq_line_item_1_view.partno_k08, dbo.rfq_line_item_1_view.p_cage_k08, dbo.rfq_line_item_1_view.p_desc_k08, dbo.rfq_line_item_1_view.fsc_k08, 
                         dbo.rfq_line_item_1_view.niin_k08, dbo.k56_tab.p_cage_k56, dbo.k56_tab.partno_k56, dbo.k55_tab.qrefno_k55, dbo.k55_tab.qotdte_k55, dbo.k57_tab.minqty_k57, dbo.k57_tab.maxqty_k57, dbo.k57_tab.untcst_k57, 
                         dbo.k56_tab.p_um_k56, dbo.k57_tab.dlyaro_k57, dbo.k56_tab.su_lbs_k56, dbo.k57_tab.idnk57_k57, dbo.rfq_line_item_1_view.s_code_k39, dbo.rfq_line_item_1_view.e_name_k12, dbo.k55_tab.idnk55_k55, 
                         dbo.k56_tab.idnk56_k56, dbo.k57_tab.valdte_k57, dbo.k56_tab.p_note_k56, dbo.k56_tab.qfactr_k56, dbo.k56_tab.q_type_k56, dbo.k55_tab.q_note_k55, dbo.k56_tab.uptime_k56, dbo.k56_tab.upname_k56, 
                         dbo.rfq_line_item_1_view.idnk39_k39, dbo.rfq_line_item_1_view.idnk08_k08, dbo.rfq_line_item_1_view.idnk12_k12, dbo.rfq_line_item_1_view.idnk42_k42, dbo.rfq_line_item_1_view.idnk43_k43, 
                         dbo.rfq_line_item_1_view.addtme_k42, dbo.rfq_line_item_1_view.rfquno_k42, dbo.rfq_line_item_1_view.rqpsta_k43, dbo.rfq_line_item_1_view.rqptme_k43, dbo.k57_tab.uptime_k57, dbo.rfq_line_item_1_view.rrqsta_k42, 
                         dbo.rfq_line_item_1_view.itmcnt_k42, dbo.rfq_line_item_1_view.uptime_k42
FROM            dbo.k57_tab INNER JOIN
                         dbo.k56_tab ON dbo.k57_tab.idnk56_k57 = dbo.k56_tab.idnk56_k56 INNER JOIN
                         dbo.k55_tab ON dbo.k56_tab.idnk55_k56 = dbo.k55_tab.idnk55_k55 INNER JOIN
                         dbo.rfq_line_item_1_view ON dbo.k56_tab.idnk43_k56 = dbo.rfq_line_item_1_view.idnk43_k43




